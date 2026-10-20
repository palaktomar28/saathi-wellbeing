/** Shared, deterministic rules. There is no trained diagnostic or forecasting
 * model in the application. Keeping these rules shared avoids browser/server
 * disagreement. Any future model must be versioned and independently evaluated. */
export const VERSION = '1.0.0';
export const CONSENT_VERSION = '2026-10-21-v1';
export const QUESTIONS = {
  phq9: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead or of hurting yourself in some way'
  ],
  gad7: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen'
  ]
};
export const OPTIONS = ['Not at all','Several days','More than half the days','Nearly every day'];
export const CONCERNS = ['Academic pressure','Sleep','Loneliness','Money worries','Feeling overwhelmed','Just checking in'];
export const RESOURCES = [
  {id:'pause', category:'Grounding', title:'Make room for a pause', time:'2 min', description:'A gentle breathing timer. Find a comfortable pace and stop if it feels uncomfortable.', tags:['Feeling overwhelmed','Just checking in'], action:'breathing', color:'sage', steps:[]},
  {id:'study', category:'Academic support', title:'One thing at a time', time:'5 min', description:'Turn a heavy workload into one small, realistic next step.', tags:['Academic pressure','Feeling overwhelmed'], color:'peach', steps:['Write down the task taking up the most space in your mind.','Choose one action you can finish in ten minutes.','Decide when to start. A small step is enough.','If deadlines feel unmanageable, ask your academic adviser about available support.']},
  {id:'sleep', category:'Rest & routine', title:'A softer end to your day', time:'5 min', description:'Create a simple wind-down routine that fits your evening.', tags:['Sleep'], color:'lavender', steps:['Choose a realistic time to begin winding down.','Set aside one stimulating activity, if that is practical.','Prepare a comfortable place to rest.','If sleep difficulties persist or affect daily life, discuss them with a qualified professional.']},
  {id:'connect', category:'Connection', title:'Reach out, your way', time:'3 min', description:'Plan a small connection with someone you trust.', tags:['Loneliness','Feeling overwhelmed'], color:'pink', steps:['Think of someone who usually listens without judgment.','Choose a comfortable way to contact them.','You might say: “I have had a difficult week. Do you have time to talk?”','Share only what feels comfortable.']},
  {id:'money', category:'Practical support', title:'Find the right campus office', time:'10 min', description:'Prepare for a conversation about fees, scholarships, or practical assistance.', tags:['Money worries','Academic pressure'], color:'sand', steps:['List the practical issue you want help with.','Check your university’s official financial-aid or student-services website.','Ask about eligibility, deadlines and documents required.','This prototype has no verified university directory and does not submit applications.']},
  {id:'counselor', category:'Professional support', title:'Prepare to speak with someone', time:'5 min', description:'A simple checklist for contacting your university counseling service.', tags:CONCERNS, color:'sage', steps:['Find the counseling service on your university’s official website.','Ask about availability, cost, confidentiality and language.','Note what you would like support with and any questions you have.','Contact the service directly. Saving this plan does not book an appointment or notify anyone.']}
];

export function scoreAssessment(kind, answers) {
  const questions = QUESTIONS[kind];
  if (!questions || !Array.isArray(answers) || answers.length !== questions.length || !Array.from(answers).every(v=>Number.isInteger(v)&&v>=0&&v<=3)) throw new Error('Please answer every question using the available choices.');
  const score = answers.reduce((a,b)=>a+b,0);
  const band = kind === 'phq9' ? (score<5?'Minimal':score<10?'Mild':score<15?'Moderate':score<20?'Moderately severe':'Severe') : (score<5?'Minimal':score<10?'Mild':score<15?'Moderate':'Severe');
  // Item 9 is independent of the total. It opens support guidance, not an
  // emergency diagnosis, automated referral, or a message to a third party.
  return {score, band, max:kind==='phq9'?27:21, needsSupport:kind==='phq9'&&answers[8]>0, scoringVersion:VERSION};
}

export function validateCheckin(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid check-in.');
  if(input.kind==='daily') {
    const {mood,energy,sleep,concerns=[]}=input;
    if(!Number.isInteger(mood)||mood<1||mood>5||!Number.isInteger(energy)||energy<1||energy>5||typeof sleep!=='number'||!Number.isFinite(sleep)||sleep<0||sleep>24||!Array.isArray(concerns)||concerns.length>6||!concerns.every(c=>CONCERNS.includes(c))) throw new Error('Check mood, energy, sleep, and selected concerns.');
    return {kind:'daily', mood,energy,sleep,concerns:[...new Set(concerns)]};
  }
  if(QUESTIONS[input.kind]) return {kind:input.kind, answers:input.answers, ...scoreAssessment(input.kind,input.answers)};
  throw new Error('Unknown check-in type.');
}

export function summarize(records) {
  const daily = records.filter(r=>r.kind==='daily').sort((a,b)=>a.created_at.localeCompare(b.created_at));
  if(!daily.length) return {count:0, average:null, change:null, text:'Your story starts with a check-in.'};
  const recent=daily.slice(-7), average=recent.reduce((s,r)=>s+r.mood,0)/recent.length;
  const change=recent.length>=2?recent.at(-1).mood-recent[0].mood:null;
  return {count:daily.length,average,change,text:change===null?'One check-in recorded. Keep going at your own pace.':change>0?'Your latest mood is higher than your first in this view.':change<0?'Your latest mood is lower than your first in this view.': 'Your first and latest mood in this view are the same.'};
}

export function recommend(concerns=[]) {
  // Preference matching only. Sorting is explainable and is not a treatment
  // recommendation. Professional support remains available at every score.
  return [...RESOURCES].sort((a,b)=>b.tags.filter(t=>concerns.includes(t)).length-a.tags.filter(t=>concerns.includes(t)).length);
}

export function sampleRecords(now=new Date()) {
  // All sample records are invented; no participant row is shipped to clients.
  return [3,2,3,3,4,3,4].map((mood,i)=>({id:`sample-${i}`,kind:'daily',mood,energy:[3,2,3,4,3,3,4][i],sleep:[6.5,6,7,7.5,7,6.5,8][i],concerns:i===6?['Academic pressure']:[],created_at:new Date(now.getTime()-(6-i)*86400000).toISOString()}));
}
