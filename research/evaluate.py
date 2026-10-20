"""Reproducible OFFLINE exploratory next-day mood benchmark.

Never predicts future PHQ-9. Never sends data to a network. Participants are
split before feature scaling or model fitting. Scores are in the original
happiness.score units, whose clinical meaning must be checked in a codebook.
Requires numpy. Raw data and output reports are intentionally gitignored.
"""
import argparse, csv, hashlib, io, json, zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data',required=True,help='Path to the supplied longitudinal CSV ZIP')
    parser.add_argument('--output',default='research/output/benchmark.json')
    args=parser.parse_args()
    with zipfile.ZipFile(args.data) as archive:
        name=next(n for n in archive.namelist() if n.endswith('.csv'))
        rows=list(csv.DictReader(io.TextIOWrapper(archive.open(name),encoding='utf-8-sig')))
    days=defaultdict(lambda:defaultdict(list)); sex={}; phq=defaultdict(set)
    for row in rows:
        uid=row['user_id']; day=datetime.fromisoformat(row['time']).date()
        days[uid][day].append(float(row['happiness.score']))
        sex[uid]=row.get('sex') or 'Missing'
        phq[uid].add(tuple(row.get(f'phq{i}') for i in range(1,10)))
    # Hash ordering is stable across Python versions. All records from a person
    # stay in one fold. Do not randomly split overlapping observation windows.
    users=sorted(days,key=lambda s:hashlib.sha256(('saathi-v1-'+s).encode()).hexdigest())
    n=len(users); train=set(users[:int(.6*n)]); valid=set(users[int(.6*n):int(.8*n)]); test=set(users[int(.8*n):])
    folds={'train':[],'validation':[],'test':[]}
    for uid in users:
        daily={d:float(np.mean(v)) for d,v in days[uid].items()}
        ordered=sorted(daily)
        for i,day in enumerate(ordered):
            target_day=day+timedelta(days=1)
            if target_day not in daily or i<2: continue
            # Require three consecutive historical days, ending before the
            # target. No interpolation or filling across missing dates.
            history_days=[day-timedelta(days=k) for k in [2,1,0]]
            if not all(d in daily for d in history_days):continue
            h=np.array([daily[d] for d in history_days])
            features=[h[-1],h.mean(),h.std(),h[-1]-h[0]]
            fold='train' if uid in train else 'validation' if uid in valid else 'test'
            folds[fold].append((uid,features,daily[target_day]))
    def arrays(name):
        r=folds[name]
        if not r:raise ValueError(f'No eligible windows in {name}')
        return np.array([x[1] for x in r]),np.array([x[2] for x in r])
    x,y=arrays('train');v,vy=arrays('validation');t,ty=arrays('test')
    mean=x.mean(0);std=x.std(0);std[std==0]=1
    def design(a):return np.column_stack([np.ones(len(a)),(a-mean)/std])
    xx=design(x);vv=design(v);tt=design(t)
    best=None
    for alpha in [0.1,1.,10.,100.]:
        penalty=np.eye(xx.shape[1])*alpha;penalty[0,0]=0
        weights=np.linalg.solve(xx.T@xx+penalty,xx.T@y)
        mae=float(np.mean(np.abs(vv@weights-vy)))
        if best is None or mae<best[0]:best=(mae,alpha,weights)
    predictions={'training_mean':np.full(len(ty),y.mean()),'last_day':t[:,0],'rolling_3_day_mean':t[:,1],'ridge':tt@best[2]}
    test_ids=[r[0] for r in folds['test']]
    # Participant-balanced metrics prevent highly active users dominating.
    rng=np.random.default_rng(42);metrics={}
    for name,pred in predictions.items():
        errors=defaultdict(list)
        for uid,err in zip(test_ids,np.abs(pred-ty)):errors[uid].append(float(err))
        subject_errors=np.array([np.mean(v) for v in errors.values()])
        boots=np.array([np.mean(rng.choice(subject_errors,len(subject_errors),replace=True)) for _ in range(1000)])
        metrics[name]={'participant_mae':float(subject_errors.mean()),'mae_95pct_bootstrap':[float(x) for x in np.quantile(boots,[.025,.975])],'window_mae':float(np.mean(np.abs(pred-ty)))}
    report={'task':'Exploratory next-calendar-day mean happiness.score prediction','not_validated_for_clinical_use':True,'observations':len(rows),'users':n,'users_with_repeated_distinct_phq_vectors':sum(len(v)>1 for v in phq.values()),'window_rules':'3 consecutive observed days predict the next consecutive observed day; no interpolation','split_users':{'train':len(train),'validation':len(valid),'test':len(test)},'eligible_windows':{k:len(v) for k,v in folds.items()},'eligible_test_users':len(set(test_ids)),'ridge_alpha':best[1],'metrics':metrics,'fairness':{},'limitations':['Mood scale semantics need the original codebook.','Daily boundaries use source timestamps without timezone conversion because source timezone is undocumented.','No future PHQ-9 target exists in these data.','Overlapping windows are kept within participants; bootstrap is by participant.','No model is integrated into the live app.','Data use permissions and collection eligibility require verification before publication of research results.']}
    pred=predictions['ridge']
    for group in sorted(set(sex.values())):
        eligible={uid for uid in test_ids if sex[uid]==group}
        if len(eligible)<10:report['fairness'][group]={'status':'Insufficient participants for reporting','minimum_required':10};continue
        errors=defaultdict(list)
        for uid,err in zip(test_ids,np.abs(pred-ty)):
            if uid in eligible:errors[uid].append(float(err))
        report['fairness'][group]={'participants':len(eligible),'participant_mae':float(np.mean([np.mean(e) for e in errors.values()])),'status':'Descriptive only; not proof of fairness'}
    dest=Path(args.output);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['users','eligible_windows','eligible_test_users','metrics']},indent=2))
    print(f'Report saved to {dest}')

if __name__=='__main__':main()
