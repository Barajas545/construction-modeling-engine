# CAT CL foundation

Date: 2026-08-18

Status: Implemented

CAT CL replaces the dedicated Level Down tool position in the left rail. The initial release provides professional two-point CAT Lines and a Measuring Tape that displays horizontal, vertical, and point-to-point values together.

CAT Lines render as yellow dashed references, remain separate from authoritative construction objects, and can be selected or deleted. CAT construction geometry and CAT dimensions have independent visibility controls. Boundary and CAT placement can snap to CAT references with 22.5°, 45°, and 90° inference; construction objects retain priority over CAT, and CAT retains priority over the grid.

CAT Line now shares Boundary's professional cursor guide. After selecting the first point, it displays live length, angle, and snap feedback and accepts exact imperial or metric entries such as `23in`, `6ft`, or `2m` followed by Enter. The typed value changes length without changing the direction established by the cursor.

Advanced CAT tools—including notes, voice capture, trim/extend, shapes, array, offset, and sketch conversion—remain intentionally deferred.
