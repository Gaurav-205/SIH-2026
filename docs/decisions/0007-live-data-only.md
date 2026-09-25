# 0007: The website shows only pipeline output; no demo data

**Context.** Earlier versions shipped a browser-side demo generator and a static benchmark table, which
risked showing invented numbers.

**Decision.** Delete all generated and demo data. The website reads only the backend, which serves only
the pipeline's exports. When no export exists, it says so (503) and shows how to produce one. "Explore the
demo" now means using the app without an account, on the same live data.

**Consequences.** The site needs the backend and at least one pipeline run. Every number can be traced
to a dataset and a run.
