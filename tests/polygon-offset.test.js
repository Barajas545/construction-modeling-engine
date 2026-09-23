import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetSelectedEdges, outwardNormals } from '../src/core/geometry/polygon-offset.js';
import { polygonArea } from '../src/core/geometry/vector.js';

// Screen coordinates: x runs right, y runs down. Every fixture below is drawn so the
// signed area is positive, which is the same winding the deck boundary tool produces.
const RECTANGLE = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }];
// Same rectangle, drawn the other way around the loop.
const REVERSED_RECTANGLE = [{ x: 0, y: 0 }, { x: 0, y: 96 }, { x: 120, y: 96 }, { x: 120, y: 0 }];
// Rectangle whose bottom side was divided at its midpoint: edges 0 and 1 are collinear.
const DIVIDED_RECTANGLE = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }];
// L-shaped deck, 120 x 96 with a 60 x 48 bite out of the lower right. Edge 2 is reentrant.
const L_SHAPE = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 48 }, { x: 60, y: 48 }, { x: 60, y: 96 }, { x: 0, y: 96 }];
// A keyhole: a 80 x 40 chamber reached through a 20 wide neck. Edge 6 is the chamber
// ceiling, and it is wider than the neck it would have to pass through.
const KEYHOLE = [
  { x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }, { x: 70, y: 80 },
  { x: 70, y: 60 }, { x: 100, y: 60 }, { x: 100, y: 20 }, { x: 20, y: 20 },
  { x: 20, y: 60 }, { x: 50, y: 60 }, { x: 50, y: 80 }, { x: 0, y: 80 },
];

function assertPointsClose(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length, 'corner count');
  actual.forEach((point, index) => {
    const matches = Math.abs(point.x - expected[index].x) <= tolerance && Math.abs(point.y - expected[index].y) <= tolerance;
    assert.ok(matches, `corner ${index} landed at ${JSON.stringify(point)}, expected ${JSON.stringify(expected[index])}`);
  });
}

const asKeys = (points) => points.map((point) => `${point.x},${point.y}`).sort();

test('moves one selected side outward and leaves every other side exactly where it was', () => {
  const result = offsetSelectedEdges(RECTANGLE, [0], 10);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, [{ x: 0, y: -10 }, { x: 120, y: -10 }, { x: 120, y: 96 }, { x: 0, y: 96 }]);
  // The untouched far side keeps both of its original corners, not just its line.
  assert.deepEqual(result.vertices.slice(2), RECTANGLE.slice(2));
  assert.equal(polygonArea(result.vertices), 120 * 106);
});

test('carries a 90 degree corner between two selected edges diagonally', () => {
  const result = offsetSelectedEdges(RECTANGLE, [0, 1], 10);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, [{ x: 0, y: -10 }, { x: 130, y: -10 }, { x: 130, y: 96 }, { x: 0, y: 96 }]);
  // Corner 1 is shared by both moving edges, so it travels 10 out on each of them.
  const travelX = result.vertices[1].x - RECTANGLE[1].x;
  const travelY = result.vertices[1].y - RECTANGLE[1].y;
  assert.equal(travelX, 10);
  assert.equal(travelY, -10);
  assert.ok(Math.abs(Math.hypot(travelX, travelY) - 10 * Math.SQRT2) < 1e-12);
  // Corner 0 is shared with an edge that did not move, so it only travels the 10.
  assert.equal(Math.hypot(result.vertices[0].x - RECTANGLE[0].x, result.vertices[0].y - RECTANGLE[0].y), 10);
});

test('moves three sides at once and leaves the fourth on its original line', () => {
  const result = offsetSelectedEdges(RECTANGLE, [0, 1, 2], 10);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, [{ x: 0, y: -10 }, { x: 130, y: -10 }, { x: 130, y: 106 }, { x: 0, y: 106 }]);
  // Edge 3 was not selected: its corners slide along it, but it stays on x = 0.
  assert.equal(result.vertices[3].x, 0);
  assert.equal(result.vertices[0].x, 0);
  assert.equal(polygonArea(result.vertices), 130 * 116);
});

test('treats a zero offset as an exact identity, even with every edge selected', () => {
  const result = offsetSelectedEdges(L_SHAPE, [0, 1, 2, 3, 4, 5], 0);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, L_SHAPE);
});

test('offsets outward the same way whichever direction the shape was drawn', () => {
  const drawnOneWay = offsetSelectedEdges(RECTANGLE, [0], 10);
  // In the reversed drawing the same physical side (y = 0) is edge 3, not edge 0.
  const drawnTheOtherWay = offsetSelectedEdges(REVERSED_RECTANGLE, [3], 10);
  assert.equal(drawnTheOtherWay.ok, true);
  assert.deepEqual(drawnTheOtherWay.vertices, [{ x: 0, y: -10 }, { x: 0, y: 96 }, { x: 120, y: 96 }, { x: 120, y: -10 }]);
  // Same four corners, same outward side: only the order around the loop differs.
  assert.deepEqual(asKeys(drawnTheOtherWay.vertices), asKeys(drawnOneWay.vertices));
});

test('grows an L-shaped deck along one of its outer edges', () => {
  const result = offsetSelectedEdges(L_SHAPE, [1], 12);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, [
    { x: 0, y: 0 }, { x: 132, y: 0 }, { x: 132, y: 48 },
    { x: 60, y: 48 }, { x: 60, y: 96 }, { x: 0, y: 96 },
  ]);
  // 8,640 square inches plus a 12 x 48 strip.
  assert.equal(polygonArea(L_SHAPE), 8_640);
  assert.equal(polygonArea(result.vertices), 9_216);
});

test('pushes a reentrant edge outward into its own notch', () => {
  const result = offsetSelectedEdges(L_SHAPE, [2], 12);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices, [
    { x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 60 },
    { x: 60, y: 60 }, { x: 60, y: 96 }, { x: 0, y: 96 },
  ]);
  // Outward for edge 2 points down into the notch, so the notch gets shallower.
  assert.equal(polygonArea(result.vertices), 9_360);
});

test('moves a sloped edge along its own normal rather than along an axis', () => {
  const triangle = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 0, y: 120 }];
  // Edge 1 is the hypotenuse x + y = 120. Moving it 5 * sqrt(2) out pushes that line to
  // x + y = 130, so both legs grow from 120 to 130.
  const result = offsetSelectedEdges(triangle, [1], 5 * Math.SQRT2);
  assert.equal(result.ok, true);
  assertPointsClose(result.vertices, [{ x: 0, y: 0 }, { x: 130, y: 0 }, { x: 0, y: 130 }]);
  assert.ok(Math.abs(polygonArea(result.vertices) - 8_450) < 1e-9);
});

test('keeps a divided edge together when both halves are selected', () => {
  const result = offsetSelectedEdges(DIVIDED_RECTANGLE, [0, 1], 10);
  assert.equal(result.ok, true);
  // The shared corner sits on two parallel lines that moved together, so it rides along.
  assert.deepEqual(result.vertices, [
    { x: 0, y: -10 }, { x: 60, y: -10 }, { x: 120, y: -10 },
    { x: 120, y: 96 }, { x: 0, y: 96 },
  ]);
  assert.equal(polygonArea(result.vertices), 120 * 106);
});

test('offsets the ceiling of a keyhole chamber while it still fits', () => {
  const result = offsetSelectedEdges(KEYHOLE, [6], 20);
  assert.equal(result.ok, true);
  assert.equal(result.vertices[6].x, 100);
  assert.equal(result.vertices[6].y, 40);
  assert.equal(result.vertices[7].x, 20);
  assert.equal(result.vertices[7].y, 40);
  // 6,000 square inches of material plus the 80 x 20 the chamber gave back.
  assert.equal(polygonArea(KEYHOLE), 6_000);
  assert.equal(polygonArea(result.vertices), 7_600);
});

test('refuses a move that would fold the shape across itself', () => {
  // 50 puts the 80 wide chamber ceiling at y = 70, across the two 20 wide neck walls.
  const result = offsetSelectedEdges(KEYHOLE, [6], 50);
  assert.equal(result.ok, false);
  assert.match(result.reason, /fold/);
  assert.equal(result.vertices, undefined);
});

test('refuses a shape with fewer than three corners', () => {
  const result = offsetSelectedEdges([{ x: 0, y: 0 }, { x: 120, y: 0 }], [0], 10);
  assert.equal(result.ok, false);
  assert.match(result.reason, /three corners/);
});

test('refuses an empty or missing edge selection', () => {
  assert.equal(offsetSelectedEdges(RECTANGLE, [], 10).ok, false);
  assert.match(offsetSelectedEdges(RECTANGLE, [], 10).reason, /at least one edge/);
  assert.match(offsetSelectedEdges(RECTANGLE, null, 10).reason, /at least one edge/);
});

test('refuses an edge index the shape does not have', () => {
  assert.match(offsetSelectedEdges(RECTANGLE, [4], 10).reason, /Edge 4 is not part/);
  assert.match(offsetSelectedEdges(RECTANGLE, [-1], 10).reason, /Edge -1 is not part/);
  assert.match(offsetSelectedEdges(RECTANGLE, [0, 1.5], 10).reason, /Edge 1.5 is not part/);
  assert.equal(offsetSelectedEdges(RECTANGLE, [undefined], 10).ok, false);
});

test('refuses to separate a divided edge whose halves would no longer meet', () => {
  // Edge 0 moves to y = -10 while its collinear neighbour edge 1 stays on y = 0.
  const result = offsetSelectedEdges(DIVIDED_RECTANGLE, [0], 10);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Edges 0 and 1 stay parallel/);
});

test('refuses non-finite corners and non-finite distances', () => {
  const broken = [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }, { x: 120, y: 96 }];
  assert.match(offsetSelectedEdges(broken, [0], 10).reason, /finite position/);
  assert.match(offsetSelectedEdges(RECTANGLE, [0], Number.NaN).reason, /must be a number/);
  assert.match(offsetSelectedEdges(RECTANGLE, [0], Number.POSITIVE_INFINITY).reason, /must be a number/);
  assert.match(offsetSelectedEdges(RECTANGLE, [0], -10).reason, /cannot be negative/);
});

test('refuses an edge with no length and a shape with no enclosed area', () => {
  const doubledCorner = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.match(offsetSelectedEdges(doubledCorner, [2], 10).reason, /Edge 0 has no length/);
  const flat = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
  assert.match(offsetSelectedEdges(flat, [0], 10).reason, /encloses no area/);
});

test('returns plain corners and keeps none of the caller fields it was handed', () => {
  const carrying = RECTANGLE.map((vertex, index) => ({ ...vertex, id: `vertex-${index}`, elevation: -12, order: index }));
  const result = offsetSelectedEdges(carrying, [0], 10);
  assert.equal(result.ok, true);
  assert.deepEqual(result.vertices[0], { x: 0, y: -10 });
  assert.deepEqual(Object.keys(result.vertices[1]), ['x', 'y']);
});

test('derives outward normals from winding, not from the order edges were drawn', () => {
  assertPointsClose(outwardNormals(RECTANGLE), [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]);
  // Edge 3 of the reversed drawing is the same physical side as edge 0 above, and it
  // reports the same outward direction even though the loop runs the other way.
  assertPointsClose(outwardNormals(REVERSED_RECTANGLE), [{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }]);
  assert.equal(outwardNormals([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])[0], null);
});
