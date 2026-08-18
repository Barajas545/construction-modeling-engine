# DCR Product Lab

# Construction Modeling Engine (CME)

# Current Characteristics and Future Direction

Version 1.0

Status: Working Vision

Owner: DCR Product Lab

Date: August 18, 2026

---

# Purpose

This document communicates what the Construction Modeling Engine is, the capabilities it has established, and the direction recommended for its continued development.

It is intended to align Product Lab, Engineering, Sales, Estimating, Field Operations, and future DCR Sales Hub integration around one shared product vision.

This document does not replace the Product Constitution or approved Product Lab specifications. It summarizes the evolving product direction and should be revised as major decisions are approved.

---

# What CME Is

The Construction Modeling Engine is a progressive construction modeling application for DCR.

CME is not traditional CAD software and is not a general-purpose drawing program. It captures how a project will be built and stores that information as structured construction data.

A salesperson can begin with a fast field sketch. An estimator can enrich the same project with construction detail. Future systems can use the same model for material takeoff, pricing, planning, visualization, and project intelligence.

The project should evolve without requiring the user to redraw it or create duplicate versions for different departments.

---

# Product Principles

## Construction reality comes first

The field defines the rules. Software preserves and communicates them. When construction reality conflicts with software convenience, construction reality wins.

## One evolving project

Field capture, detailed modeling, takeoff, estimating, and visualization should enrich the same project model.

## Tablet-first workflow

The primary field experience must remain fast and understandable on a tablet. Desktop tools may provide greater control, but they should preserve the same mental model.

## Construction objects, not disconnected lines

Deck Boundaries, edges, stairs, railings, levels, and future framing objects should retain stable identities and meaningful relationships.

## Deterministic quantities with human authority

Material quantities should be calculated from structured construction objects. Estimators must be able to adjust them without losing the original calculated value or the reason for the adjustment.

## Progressive complexity

Simple projects should remain simple. Greater detail should appear only when the project or user requires it.

## Traceability

The application should distinguish calculated, adjusted, manual, quoted, and purchased information so DCR can understand how a result was produced.

## Independent architecture

CME should remain independently deployable while under development. Connections to DCR Sales Hub, SharePoint, OneDrive, suppliers, and other systems should use explicit versioned contracts.

---

# Current Characteristics

## Progressive project model

- Multiple independent Deck Boundaries can exist in one project.
- Each Deck Boundary can own a level relative to the main deck.
- Project surface area is calculated across all deck areas.
- Projects are stored as structured, serializable documents.
- Construction-object identities are preserved whenever geometry changes safely.

## Deck Boundary

- Custom polygon creation with construction-oriented snapping.
- Numeric length entry and live angle feedback.
- Node and edge editing after creation.
- Insert, split, delete, merge, and move operations.
- Horizontal, vertical, and fixed-angle constraints.
- Edge and node locks with visible constraint indicators.
- Forty-five-degree chamfer creation.
- Editable edge properties including House Attachment, Fascia, and Picture Frame.
- Selectable area annotations and movable dimension leaders.
- Deck-board direction represented directly on the deck surface.

## Stairs

- Click-and-drag creation from an existing Deck Boundary edge.
- Live total-rise feedback during placement.
- Automatic riser and tread generation.
- Connections between upper and lower Deck Boundaries.
- Editable width and stair dimensions while preserving parallel geometry.
- Selectable Deck–Stair interface construction edge.
- Validation when connected levels or landings change.
- Stair-covering quantities available to the initial Takeoff system.

## Railing

- Click-and-drag railing runs inside or outside a Deck Boundary.
- Edge, corner, and grid snapping.
- Independent visibility layer.
- Automatically generated sections and posts.
- Initial Wild Hog and Trex system identities.
- Editable panel count and object-specific properties.
- Initial Wild Hog material recipe available to Takeoff.

## Levels

- Multiple deck elevations inside the same project.
- Level Down construction geometry and shaded lowered regions.
- Selectable level annotations with movable leaders.
- Darker surface hierarchy as project elevation decreases.
- Stair connections between independently modeled deck levels.

## CAT Construction Lines

- Independent construction-reference layer.
- Exact Line tool using imperial or metric entry.
- Measuring Tape with horizontal, vertical, and point-to-point measurements.
- Trim and Extend operations.
- Text and optional voice notes with fixed arrow points and movable labels.
- Twenty-two-and-a-half, forty-five, and ninety-degree inference.
- CAT geometry can guide future Deck Boundary creation without becoming permanent deck geometry.

## Dimensions, visibility, and precision

- Independent visibility for Decking, Railing, Dimensions, Grid, CAT lines, and CAT annotations.
- Movable dimension labels and object-connected arrowheads.
- Configurable edge, node, inference, and grid snapping.
- Mouse, touch, pan, and zoom interaction foundations.

## Projects and export

- Multiple projects can be created and stored independently on one device.
- Projects autosave locally and can be renamed, reopened, or deleted.
- CME Sketch Plan PDF export.
- DCR Sales Hub Step 1 JSON containing deck area, railing length, stair count, and sketch identity.
- A versioned integration boundary prepared for future direct connection to DCR Sales Hub.

## Initial Takeoff

- Expandable material categories.
- Automatic, adjusted, and manual material lines.
- Editable quantities and optional unit prices.
- Initial calculations for grooved decking, square-edge picture frame, fascia, stair covering, and Wild Hog railing.
- Manual material entry for Framing, Hardware, Protection, and Custom materials.
- Supplier-facing export without prices.
- Internal export with prices.
- Structured Takeoff JSON for future reference projects and integrations.

---

# Role Within DCR

## Field Sales

CME should help a salesperson document the project quickly and capture the quantities required for the first stage of the sales process:

- Decking square feet.
- Railing linear feet.
- Stair count.
- Deck levels and relationships.
- Construction notes and field references.
- A visual sketch that can be understood by someone who did not visit the jobsite.

## Estimating

The estimator should continue enriching the same model with:

- Material selections.
- Detailed Takeoff.
- Framing systems.
- Posts and footings.
- Construction notes.
- Supplier pricing.
- Waste, alternates, and project-specific adjustments.

## DCR Sales Hub

DCR Sales Hub should remain the commercial workflow and opportunity record. CME should become its specialized construction-modeling surface.

The intended future workflow is:

1. A salesperson opens an opportunity in DCR Sales Hub.
2. The salesperson launches CME from Step 1.
3. CME receives the opportunity identity through a trusted versioned connection.
4. The salesperson creates or updates the sketch.
5. CME returns field quantities and a reference to the project.
6. The estimator later opens the same CME project and adds detail.
7. Updated Takeoff and estimate information becomes available without redrawing the project.

---

# Future Direction

## Phase 1 — Field-ready reliability

- Convert CME into an installable Progressive Web Application.
- Support dependable offline project creation and editing.
- Replace basic browser storage with a more robust local project database.
- Add visible offline, saved, pending-sync, and synchronized states.
- Provide local backup and recovery exports.
- Continue tablet and touch refinement.

## Phase 2 — Decking material intelligence

- Manufacturer, collection, color, profile, and SKU catalog.
- Actual board width, gap, and available stock lengths.
- Course-by-course board layout from deck geometry and board direction.
- Picture frame and breaker-board rules.
- Cut optimization for common stock lengths.
- Reuse of offcuts where construction rules permit.
- Transparent waste calculations.
- DCR-approved stair tread and riser recipes.
- Clear confidence and review indicators.

## Phase 3 — Railing and stair assemblies

- Versioned DCR material recipes for Wild Hog, Trex, wood, cable, and custom railing.
- Material quantities derived from panels, posts, corners, gates, and stair runs.
- Editable fastener and blocking standards.
- Save project adjustments as optional future DCR standards.
- Preserve the recipe version used by every project.

## Phase 4 — Detailed construction modeling

- Joist Groups.
- Beams.
- Ledger and House Attachment systems.
- Rim and band framing.
- Blocking.
- Posts and footings.
- Stair framing.
- Demolition and existing-condition objects.
- Object-driven connectors, hardware, and fastener quantities.

## Phase 5 — Shared project storage

- DCR identity and access control.
- SharePoint or OneDrive project storage.
- Cross-device project access.
- Offline synchronization queue.
- Conflict detection and resolution.
- Revision history and recovery.
- Project handoff between Sales, Estimating, and Operations.

## Phase 6 — Supplier pricing and quoting

- Manual price entry remains supported at all times.
- Supplier-specific product mapping and branch selection.
- Requests for quotation exported without prices.
- Import of supplier quotes.
- Price source, date, unit, availability, tax, and delivery traceability.
- Approved online price lookup where supplier terms and data availability permit it.
- Human review before supplier information affects a customer estimate.

## Phase 7 — Estimating and learning

- Material, labor, delivery, tax, and markup separation.
- Estimate alternates by product system.
- Comparison between calculated, adjusted, quoted, purchased, and installed quantities.
- Historical project reference library.
- Recommendations based on DCR-approved standards and completed-project evidence.
- AI assistance for research and pattern discovery without replacing deterministic construction calculations.

## Phase 8 — Visualization and downstream use

- Art Studio visualization using the same construction model.
- Construction plan and field-document generation.
- Material and installation summaries.
- Operations handoff.
- Future schedule, purchasing, and production intelligence.

---

# Takeoff Data Strategy

The Takeoff system should preserve the following relationship:

```text
Construction model
→ Calculated material quantity
→ User adjustment
→ Supplier quote
→ Purchased quantity
→ Final project result
```

The calculated value must never disappear when a user overrides it. This history allows DCR to improve standards using evidence instead of assumptions.

Future Takeoff records should include:

- Construction object source.
- Material category and assembly.
- Manufacturer and product identity.
- Size, profile, color, and stock length.
- Calculated quantity.
- Effective purchase quantity.
- Waste amount and reason.
- Unit price and source.
- Supplier and branch.
- Quote and purchase status.
- User notes and review state.

---

# Offline Strategy

CME is especially valuable at jobsites where internet access may be weak or unavailable. The long-term product should therefore be offline-first.

After an initial installation, users should be able to open CME, create projects, model decks, add stairs and railings, write notes, and generate Takeoff without a network connection.

Internet access would remain necessary for:

- Cloud synchronization.
- Direct DCR Sales Hub communication.
- Supplier pricing.
- Shared project collaboration.
- Online AI services.

Offline work must remain clearly identified and synchronize safely when connectivity returns.

---

# Information That Must Remain Separate

CME should distinguish these concepts rather than blending them into one number:

- Geometry.
- Construction intent.
- Material quantity.
- User adjustment.
- Supplier price.
- Labor.
- Markup.
- Customer price.

This separation makes calculations explainable, correctable, and reusable across departments.

---

# Product Decisions Still Required

Product Lab and Engineering should continue defining:

- Official DCR decking layout and waste rules.
- Approved stair-covering recipes.
- Approved railing assemblies.
- Material naming and catalog governance.
- Supplier data-access methods.
- Project ownership and permissions.
- SharePoint or OneDrive storage strategy.
- Offline synchronization behavior.
- Estimate review and approval roles.
- Which construction rules are recommendations and which are enforced constraints.

---

# Risks and Guardrails

- Preliminary quantities must be labeled clearly and must not appear more precise than the model supports.
- Supplier prices must record their source and date.
- AI should not silently change construction quantities or approved standards.
- Manual overrides must remain visible and reversible.
- Cloud synchronization must not overwrite newer offline work without warning.
- Product recipes must be versioned so completed projects remain reproducible.
- CME should not claim code compliance unless the relevant rule set, jurisdiction, and review process have been formally implemented.

---

# Measures of Success

CME is successful when:

- A salesperson can document a typical project at the jobsite in minutes.
- An estimator can understand the project without requiring a second sketch.
- The same project progresses from field capture to detailed Takeoff.
- Material lists explain where every quantity came from.
- User corrections improve future DCR standards.
- Projects remain usable with weak or temporary internet access.
- DCR Sales Hub receives reliable quantities and project references.
- The model becomes more valuable as construction detail is added.

---

# Long-Term Vision

CME should become the structured construction knowledge layer connecting DCR Sales, Estimating, Field Operations, suppliers, and future visualization tools.

Its greatest value will not come from drawing faster. Its greatest value will come from preserving how DCR builds, converting that knowledge into reliable quantities, and allowing every completed project to improve the next one.
