# Dataset review and experimental scope

The supplied files support exploratory mental-health research but do not support all claims in the original proposal. This document distinguishes observed facts, a reproducible experiment, and features needing new evidence.

## Survey data

- 2,028 rows in the raw and processed survey; 6 exact duplicate rows in each.
- Anxiety, depression and stress CSVs are aligned projections of the processed survey, not independent cohorts.
- No repeated-assessment timestamps or stable participant IDs are provided.
- All depression and anxiety totals equal their questionnaire item sums. Their labels follow score thresholds.
- Academic and semester-specific wording differs from standard screening instruments.
- Stress totals reverse the adapted file's positive items 5, 6, 7 and 8. Do not blindly apply standard PSS positional indices to this reordered instrument.
- 1,996 respondents are aged 18–26. Only 3 are above 30. Gender counts are 1,405 male, 613 female, and 10 who prefer not to say.

Consequently, the app uses direct questionnaire scoring rather than training a model to reproduce a label formula. A random row split of these files would not validate future symptoms or independent populations. Duplicate responses must be handled cautiously because identical answers do not always establish duplicate people.

## Longitudinal data

The ZIP contains 16,150 rows from 185 users. Each user has exactly one distinct PHQ-9 vector repeated across their rows. The dataset contains varying mood observations but no changing PHQ-9 target per participant. Age is missing for 74 users; recorded sex includes 129 female, 31 male, 24 missing and 1 transgender user. The filename's “14-day” label does not constrain all raw observation spans to 14 days.

The q-series fields have extensive missingness. Without a codebook, do not assume this means nonresponse: questions may be scheduled. Do not replace missing values with zero, manufacture future PHQ-9 assessments, merge unrelated participants across datasets, or use post-outcome observations to predict a retrospective assessment.

## Offline next-day mood benchmark

The included `research/evaluate.py` uses only dated `happiness.score` observations and user IDs, with sex retained for limited descriptive error reporting. It predicts next-calendar-day average mood from three consecutive observed days. This is exploratory forecasting, not diagnosis or a treatment recommendation.

Protocol:

1. Deterministically order participant IDs using a salted SHA-256 hash.
2. Split participants 60/20/20 into training, validation and test groups.
3. Average within source calendar days. Require all three historical days and the next target day; do not interpolate.
4. Use the latest daily mean, three-day mean, three-day standard deviation, and change as predictors.
5. Fit scaling parameters only on training data.
6. Select ridge regularization from 0.1, 1, 10 and 100 using validation MAE.
7. Compare once on held-out participants with the training mean, last-day value and rolling mean.
8. Report participant-balanced MAE and participant bootstrap intervals. Suppress subgroup error reporting below 10 eligible test participants. This reporting threshold is a conservative display rule, not a statistical sufficiency guarantee.

Observed local run on the supplied file:

| Model | Participant-balanced test MAE | 95% participant bootstrap interval |
|---|---:|---:|
| Training mean | 0.746 | 0.646–0.853 |
| Last observed day | 0.521 | 0.448–0.597 |
| Three-day rolling mean | 0.473 | 0.407–0.538 |
| Ridge regression | 0.478 | 0.428–0.533 |

There were 3,104 training windows, 1,099 validation windows and 1,239 test windows from 37 eligible test participants. Units are the source `happiness.score` scale. The rolling mean slightly outperformed ridge on this split; no claim of a statistically significant difference is made. These results do not justify a clinical deployment, a 2–4-week horizon, or an LSTM superiority claim. No model is shipped in the live prediction path.

Limitations: source timezone and scale semantics need documentation; repeated windows within people are correlated; the cohort may not represent local university users; data-use permissions and eligibility must be checked; the experiment has no clinical or external-site validation. The published Moodpath analysis uses eligibility criteria that should be reproduced before attempting to compare to its results. This script intentionally does not claim replication of that paper.

## What to collect for the original proposal

For 2–4-week symptom forecasts, obtain repeated validated assessments with stable participant IDs, exact assessment times, sufficient history and future follow-up, consent, and intervention records. For support-need classification, obtain independently reviewed labels and user preferences; do not relabel severity bands as support needs. For fairness, plan adequate participant counts per prespecified group, report uncertainty, and assess access and referral completion as well as model errors.

## Sources

- Burchert et al. (2021), [Screening accuracy of a 14-day smartphone ambulatory assessment](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0244955).
- [PHQ and GAD instruments](https://www.phqscreeners.com/).
- Carnegie Mellon University, [PSS scoring](https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pssscoring.html).
