# DCR Product Lab

# CME Connectivity and Export Direction

Version 1.0

Status: Product direction

Owner: DCR Product Lab

---

# Purpose

The Construction Modeling Engine should support the salesperson during Step 1 of DCR Sales Hub without requiring detailed construction modeling.

CME is the visual field-capture surface. DCR Sales Hub remains the commercial workflow.

The salesperson should be able to create only the Deck Boundaries, Railings, and Stairs needed for an initial opportunity. CME calculates the field quantities and preserves the sketch so another person can continue enriching the same construction model later.

---

# Step 1 User Flow

1. The salesperson opens an opportunity in DCR Sales Hub.
2. Step 1 presents a **CME Sketch Plan** action.
3. Sales Hub launches CME with the opportunity identity and a trusted return context.
4. The salesperson creates a field sketch without being forced to assign materials, fascia, framing, or takeoff details.
5. The salesperson selects **Save to Step 1**.
6. CME returns the calculated Decking square feet, Railing linear feet, Stair count, and stable sketch reference.
7. Sales Hub updates Step 1 and retains access to the same CME project.

When a sketch already exists, Sales Hub should display **View CME sketch** instead of requiring a new sketch.

---

# Step 1 Data Contract

CME owns a versioned JSON contract identified by:

`com.dcr.sales-hub.step-1.cme`

The first contract includes:

- CME project ID and name.
- CME model schema and schema version.
- DCR Sales Hub opportunity ID when CME was launched from an opportunity.
- Total Decking square feet.
- Individual Deck Boundary areas and down levels.
- Total Railing linear feet.
- Railing runs grouped by assigned railing type.
- Stair count.
- Workflow stage and last model update.
- Export timestamp.

The contract intentionally excludes estimates, prices, and unconfirmed material assumptions. Future additions must be versioned so older Sales Hub records remain readable.

---

# Connection Strategy

The initial CME implementation supports two delivery paths using the same JSON contract.

## Connected launch

Sales Hub opens CME with an opportunity ID and trusted Sales Hub origin. When **Save to Step 1** is selected, CME sends a versioned `dcr.cme.step1.ready` message to the window that launched or contains CME.

Only an explicit HTTP or HTTPS origin may receive the message. CME must never send project data to a wildcard origin.

This browser message establishes the interaction contract. A later production integration may replace delivery with an authenticated Sales Hub API while retaining the same payload.

## Standalone fallback

When CME was not opened from Sales Hub, **Save to Step 1** downloads the Step 1 JSON. **Export options** also provides an explicit **Download Step 1 JSON** action for testing, support, and manual transfer.

The fallback is not the final salesperson workflow. The final workflow should require no manual download or upload.

---

# Project Storage Direction

CME currently keeps multiple independent projects on the device and automatically migrates the previous single-project save into the project library.

Future SharePoint or OneDrive storage should preserve the same project IDs and versioned CME document format. Replacing local storage with shared storage must not require changes to construction-object identities or the Sales Hub data contract.

A future shared project package may include:

- `model.json` as the authoritative editable CME model.
- `summary.json` for calculated quantities.
- `preview.png` for quick visual recognition.
- `drawing.pdf` for a human-readable sketch plan.
- Project metadata and attachments.

---

# Export Experience

The primary action is **Save to Step 1**. Detailed export choices remain secondary under **Export options**.

## Export PDF

The PDF is a professional visual construction document rather than a screenshot. It includes the project name, fitted sketch, visible construction dimensions, Decking square feet, Railing linear feet, and Stair count.

## Download Step 1 JSON

This exports the exact versioned Sales Hub payload used by the connected workflow.

## Future exports

Additional formats should be introduced only when their workflow is defined. Likely future options include a complete `.cme` project package, takeoff reports, estimate data, and SharePoint or OneDrive project publishing.

PNG, SVG, DXF, CSV, and material exports should not be added merely because they are technically possible.

---

# Product Principles

- The salesperson should spend time measuring, not managing files.
- Step 1 requires only the minimum reliable field quantities.
- Detailed modeling remains optional during field capture.
- The sketch is never discarded after Step 1.
- The estimator continues from the salesperson's exact model.
- Exported quantities are calculated from authoritative CME construction objects.
- Every connection and export format is versioned and serializable.
