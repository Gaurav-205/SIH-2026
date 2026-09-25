# 0002: 29 district centroids before a 0.25° grid

**Context.** Open-Meteo weights each location as a call. The two regions at 0.25° are about 630 cells,
about 800k calls: months on the free tier.

**Decision.** Start with 29 district centroids (about 40k calls). Keep every step grid-ready: the grid
is a config change, and the Zarr ingester reads any set of coordinates.

**Consequences.** Spatial scores such as the Fractions Skill Score are not available yet. Truth comes
from the IMD cell nearest each centroid (stored with every value). Some centroids share an IMD cell
(Alappuzha and Kottayam), which is reported.
