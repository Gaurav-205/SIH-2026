# 0004: One pooled Stage B model instead of one per source

**Context.** The plan suggests one LightGBM per source. With two years at 29 points, each source has
about 10k rows per lead; several sources start later (AIFS, UKMO) and would have fewer.

**Decision.** Train one LightGBM on all sources, with the source id as a categorical feature, predicting
log(corrected error² + 0.1).

**Consequences.** Sources share learned structure (lead, terrain, regime effects), and new sources get
sensible predictions. Source-specific behaviour is still learnable through the id. If data grows,
per-source models can be compared in validation with no other change.
