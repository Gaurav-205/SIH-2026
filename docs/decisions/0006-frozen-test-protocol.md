# 0006: Freeze, then score the 2025 monsoon once, with a logged guard

**Context.** With only two monsoons, tuning on the test season, even by looking, would overstate skill.

**Decision.**
- Choose everything with blocked cross-validation on the training period. The few tuned scalars are
  cross-fitted.
- Freeze an immutable artifact (git commit, config hash, data manifest).
- `ml.evaluate.test_scorecard` refuses to run if the config changed since freezing, if the test season
  is incomplete, or if it already ran. A re-score needs a reason, which is appended to
  `ml/reports/test_runs.log`.

**Consequences.** Test results are credible and auditable. Improvements found after the test must be
validated on new data (the 2026 live check), not on the 2025 test season.
