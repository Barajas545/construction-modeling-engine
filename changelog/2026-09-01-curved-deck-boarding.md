# Curved Deck Boarding Direction

- Board Direction now accepts a curved Deck Boundary edge as its reference.
- The selected arc identity, centre, radius, board width, and gap remain structured and serializable with the DB.
- Decking seams are generated as concentric curves and clipped to the actual curved Deck Boundary outline.
- Hosted Stair footprints continue to interrupt the decking pattern.
- The straight Board Direction workflow remains unchanged; Rotate 90° is intentionally unavailable for a curved pattern.
- Editing the referenced boundary arc updates the derived pattern from the current arc geometry.

Curved boarding remains a preliminary plan and takeoff aid. The estimator must review material-system limits and any heat-bending fabrication method.
