# Bharosa documentation

Bharosa blends physics, AI and ensemble weather forecasts into one rainfall forecast for Indian
districts. Each model is weighted by how well it has recently verified against India Meteorological
Department (IMD) observations at that place, lead time and season. Built for Smart India Hackathon
problem **SIH26081** (NCMRWF, Ministry of Earth Sciences).

| Read this | If you want to |
| :--- | :--- |
| [Architecture](architecture.md) | see how the pieces fit: pipeline, backend, website |
| [Data sources](data-sources.md) | know every dataset: licence, coverage, how it was verified and used |
| [Methodology](methodology.md) | understand the science: day conventions, leakage rule, Stage A/B, extremes, regimes |
| [ML pipeline](pipeline.md) | run ingestion, feature building, training, validation and the daily cycle |
| [Verification](verification.md) | read the scorecards and understand every score |
| [API](api.md) | call the backend or change the data contract |
| [Frontend](frontend.md) | work on the website |
| [Operations runbook](operations.md) | run it every day, schedule it, fix it when something breaks |
| [Development guide](development.md) | set up, test, lint, add a source or a feature, contribute |
| [Decision records](decisions/README.md) | see why things are the way they are |
| [Glossary](glossary.md) | look up a term |
| [Changelog](changelog.md) | see what changed |

## Ground rules the whole project follows

1. **Never invent numbers.** Every number on the website or in a report comes from code run on real
   data, and names the dataset it was scored against.
2. **No leakage.** A forecast for lead L valid on day V only uses verified errors up to V − L. Unit tests
   enforce this.
3. **Freeze before test.** The 2025 monsoon is held out. It is scored once, by a frozen model, and every
   look at it is logged.
4. **Report losses too.** Scores are given per lead, with bootstrap confidence intervals. An interval that
   crosses zero is not called a win.
5. **Cache everything; respect licences and rate limits.** Every source is attributed.
