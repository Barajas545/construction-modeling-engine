# Takeoff

Riser fascia stock refinement: `planStairRiserFasciaStock` uses 12/16 ft stock (optional serialized `takeoff.settings.stairRiserFasciaStockFeet` catalog), keeps full-width riser cuts continuous, and leaves configured waste/cutting reserve. Exactly 12 LF net advances to a 16 ft purchase even with zero waste. `requiredLinearFeet` still counts risers only; side fascia is separate and retains its existing stock setting. Length-specific IDs are `auto:stairs:fascia-risers:12` / `:16`; overlength cuts remain a REVIEW row rather than being silently spliced. Existing unsuffixed riser overrides are retained in storage but not applied to a different stock length.

Stair covering now uses the Pictureframe/Square cut recipes in `../stairs/stair-covering.js`. The Stairs category contains square-shoulder tread decking, riser fascia, and side fascia, replacing the old grooved/nosing/square-riser rows. Configured square-edge and fascia stock lengths and waste apply; 16 inches per side is already included in net LF. These are REVIEW purchase allowances, not cut optimization. Old automatic-row overrides remain stored but do not transfer to the replacement materials. Stair 2x12 PT framing remains in Framing.

The Takeoff tool converts established CME construction objects into editable purchase material lines. Automatic calculations retain stable line identities, while project-specific quantity and price overrides remain separate from the calculated values. Manual lines use the same serializable project contract.

The initial material recipes cover Decking & Trim, stair covering, and Wild Hog railing. Wild Hog uses one `6 ft. Wild Hog Black Aluminum Hog Track Kit` per calculated railing panel; it is a discrete kit rather than a linear-foot track allowance. Framing, hardware, protection, and custom categories intentionally begin with manual material entry until their authoritative construction objects exist.

A curved Deck Boundary edge marked as Rim Joist is one logical framing member even though the contour is sampled internally. Takeoff uses the analytical arc length once, inherits the dominant Joist Field profile in that DB, and labels the stock for bending/lamination review. A curved Picture frame is separated from straight picture-frame stock as `auto:decking:square-picture-frame-curved`, described as heat-bent square-edge composite decking and also measured from analytical arc length.

Wild Hog `2×6 DW handrail` is planned per straight railing run rather than as pooled 8-foot pieces. CME groups consecutive panels, keeps joints at posts, and selects from 8, 10, 12, 16, and 20-foot stock to minimize purchased length and piece count. A 9′ 4″ two-panel run therefore buys one 10-foot handrail.

Wild Hog railing posts are modeled as 5-foot cuts purchased from `4×4×10` stock. Each stock piece yields two posts, and odd totals always round upward so material is never short.
