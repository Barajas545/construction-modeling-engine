# CME Takeoff

Version 1

Status: Initial implementation

## Purpose

Takeoff transforms established CME construction objects into an editable, serializable material list. Geometry remains authoritative for automatic quantities, while the estimator retains control over purchase quantities, prices, and project-specific materials.

## Material categories

- Decking & trim
- Stairs
- Railing
- Framing
- Fasteners & hardware
- Protection & finishes
- Custom materials

Every category accepts manual material lines even before CME has an authoritative construction object capable of calculating them.

## Quantity provenance

- `AUTO`: calculated from current construction geometry.
- `ADJUSTED`: an automatic line with a project-specific quantity override.
- `MANUAL`: a user-created material line.

Automatic lines retain `calculatedQuantity` when adjusted. Editing the model recalculates the underlying quantity without silently deleting the user's purchase decision. Reset restores the current calculated quantity.

## Initial automatic recipes

Decking uses Deck Boundary area, stair footprint, fascia edge properties, picture-frame edge properties, board width, board gap, stock length, and waste settings. Stair covering uses the established tread, riser, and width dimensions. Wild Hog railing expands established railing runs into panels, aluminum track, 2×6 handrail, two 2×4 supports per panel, and 4×4×5 posts.

Stair covering and railing accessory recipes are marked for review because DCR standards and manufacturer-specific selections may change their final quantities.

## Editing and export

Quantity and unit price are editable independently. Users can add or remove project materials and export:

- A supplier quote without prices.
- An internal takeoff with known prices.
- A structured Takeoff JSON snapshot for future DCR Sales Hub and shared-storage integration.

The deterministic quantity engine remains separate from future supplier pricing agents. Price records should eventually include supplier, branch, SKU, lookup date, and whether freight and tax are included.
