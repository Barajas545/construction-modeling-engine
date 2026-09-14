# Manual Post / Footing tool

Implemented on 2026-08-25.

- Simplified the Framing toolbar to Joist, Beam, Post / Footing, and Done.
- Removed Pillar and legacy Repeat/O.C. controls from the toolbar; Joist Field spacing remains in selected-field properties.
- A manual Post / Footing owns a structured footing with a 16-inch preliminary plan size and three 60 lb concrete bags by default.
- The drawing renders the footing beneath its post.
- Takeoff adds one Simpson Strong-Tie ABW Post Base and the modeled concrete allowance per manual assembly.
- Manual placement uses CME snap and may be positioned beneath a Beam or Rim / Flush, including at the centre of a Double Joist span.
- Existing Pillar objects remain supported for backward-compatible project loading but cannot be newly placed from this toolbar.
