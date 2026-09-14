# CAT arcs, Offset, and derived CAT Boundaries

- Straight CAT construction lines can be converted to and reshaped as circular arcs from Object properties; endpoints remain fixed and the CAT object remains serializable.
- CAT Tools now includes Offset with a live workspace dimension and the same typed-distance workflow used by Line.
- The most recent dimension is retained as Repeat Offset; the next source line needs only a side selection, while typing a new dimension replaces the retained value.
- Adjacent straight source lines produce offset lines joined at a shared miter corner.
- CAT arcs offset concentrically by increasing or decreasing their original radius.
- Trim supports both straight CAT Lines and CAT arcs, using real finite intersections.
- Extend now locks the first selected CAT Line, presents a lower-left **Extend to line intersection** guide, and waits for a second CAT Line reference.
- Extend changes only the first line. Straight lines continue to their virtual line intersection; arcs continue along their original circumference to line or arc intersections.
- A connected closed loop of CAT Lines derives a selectable CAT Boundary without storing duplicate geometry.
- Closed CAT Boundaries render with a 25% transparent orange fill and a CAT-colored area annotation.
- The CAT area annotation exposes **Convert to Deck Boundary**. Conversion preserves curved segments, removes the source loop's CAT Lines, and creates a normal authoritative construction object.

The derived-region design keeps CAT auxiliary until the estimator explicitly converts it, while keeping project data and calculation inputs structured and serializable.
