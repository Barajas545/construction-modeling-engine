# Shared Rim / Flush support across Deck Boundaries

Implemented on 2026-08-25.

- A Joist Field remains owned by and clipped to the Deck Boundary selected before placement.
- Rim / Flush edges are resolved from every modeled Deck Boundary and clipped to the selected DB.
- A neighboring Rim / Flush, including a Double Joist, may terminate joists approaching from either connected deck when its physical geometry crosses or coincides with the selected surface.
- The shared support keeps the identity and Takeoff quantity of its owning edge; CME does not create a duplicate beam or duplicate material for the second DB.
- Ledgers remain local to their owning Deck Boundary.
- Automated coverage verifies that the neighboring support closes the field while every generated joist retains the selected DB identity.
