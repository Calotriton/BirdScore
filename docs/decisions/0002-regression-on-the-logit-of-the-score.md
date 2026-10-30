# 0002. Logistic regression on the logit of the score, with no penalty
Status: Proposed, for the owner to confirm
Date: 2026-10-30

## Context
BirdScore must turn checked detections into a curve of the probability of a correct identification against the confidence score, and read thresholds from it. The choice of predictor and of fit changes every threshold.

## Options considered
- **Logit of the score, by maximum likelihood.** The approach attributed to Wood and Kahl (2024), and the one in the owner's Apus and ChirpID.
- **The score as it is, by maximum likelihood.** Simple, but a curve on the raw score can need a score above 1 to reach a high probability, and it does not go to 0 at a score of 0.
- **Either one with a penalty,** such as scikit-learn's default L2. A penalty shrinks the slope by an amount that depends on the sample size, so curves from sets of different sizes are not comparable. It has no scientific reason here.

## Decision
- The logit of the score is the default, and the score as it is stays available under Advanced.
- No penalty. Scores of exactly 0 or 1 are moved to 0.000001 and 0.999999 before the logit, the same limit as Apus and ChirpID, so that results agree.
- The band is the 95% Wald interval on the logit scale, as a standard GLM reports it. The interval of a threshold is where that band reaches the target probability (Fieller's theorem). Both are computed in closed form and need no random numbers.
- With no overlap between positive and negative clips, no finite fit exists, so BirdScore draws no curve and says why.
- The default mark is p = 0.90, with chips for 0.85, 0.95 and 0.99.

## Evidence
- The full text of [Wood and Kahl 2024](https://doi.org/10.1007/s10336-024-02144-5) could not be read: it is closed access, and OpenAlex lists no open copy. The use of the logit rests on a paper that cites it and describes the method in those words, read in full: [Bird Song Detector, arXiv:2503.15576](https://arxiv.org/abs/2503.15576), which transforms scores to logits, fits a logistic regression, and shows a confidence band. It applies this to its own detector, not to BirdNET. Read Wood and Kahl before citing specifics from them.
- `tests/test_core.py` checks the coefficients, covariance, log-likelihood, AIC and band against statsmodels on simulated data, on both scales, and the coefficients against scikit-learn with no penalty.
- On real validation sets checked locally, the two scales fit about equally (AIC within 1.5), and the raw scale put one threshold for p = 0.99 above 1.

## Consequences
- Easier: thresholds always lie between 0 and 1, and results agree with the owner's other tools.
- Harder: thresholds differ a little from plots made with a raw score and a penalty.
- Clips are treated as independent, so the band and the intervals can be too narrow when many clips come from one recording or night. A bootstrap over recordings would address it, at the cost of random numbers and of slower plots. The results table shows the number of recordings so that this can be judged.
- To reverse: the default is one line in `app/app.js`, and users can already switch.
