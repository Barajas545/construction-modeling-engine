import { createProjectDocument, parseProject, serializeProject, setProjectWorkflowStage, upsertObject } from '../core/document/project-document.js';
import { deriveModelProgress } from '../core/construction-objects/progressive-model.js';
import { normalizeBoundaryEdge } from '../core/construction-objects/edge-properties.js';
import { collectSnapTargets, resolveSnap } from '../core/geometry/snap-engine.js';
import { nearestPointOnSegment } from '../core/geometry/vector.js';
import { formatFeetInches, formatSquareFeet } from '../core/units/length.js';
import { parseConstructionLength } from '../core/units/parse-length.js';
import { CommandStack, replaceDocument } from '../history/command-stack.js';
import { adaptiveGridSpacing, createViewport, fitViewport, panViewport, zoomViewport } from '../rendering/viewport-controller.js';
import { constrainEdge, createDeckBoundary, establishDeckBoundary, findAdjacentMergeCandidate, getBoundaryLifecycle, insertVertex, markBoundaryEdited, mergeAdjacentVertices, offsetEdge, removeVertex, setEdgeLength, setEdgeRole, updateEdgeProperties, updateVertex, validateDeckBoundary } from '../tools/deck-boundary/deck-boundary.js';
import { attachStairToBoundary, deriveStairDragOptions, deriveStairTreads, validateStairPlacement } from '../tools/stairs/stair.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'cme.project.v1';
const app = document.querySelector('#app');
const history = new CommandStack();
let documentModel = loadProject();
let mode = 'select';
let draft = [];
let pointerWorld = null;
let draggingVertexId = null;
let dragStartDocument = null;
let draggingEdgeId = null;
let edgeDragStart = null;
let mergeCandidateId = null;
let selected = { kind: null, id: null };
let message = 'Ready';
let viewport = createViewport();
let panGesture = null;
let lastMiddleClick = 0;
let snapState = { type: 'grid', label: 'Grid', guides: [] };
let numericBuffer = '';
let lastLength = null;
let gridSetting = 'auto';
let gridVisible = true;
let viewportAnimation = 0;
const activeTouches = new Map();
let touchGesture = null;
let pendingTouch = null;
let stairDraft = null;
let stairGesture = null;

function loadProject() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createProjectDocument({ name: 'Backyard deck' });
  try { return parseProject(saved); } catch { return createProjectDocument({ name: 'Recovered project' }); }
}

function boundary() {
  return documentModel.objects.find((object) => object.type === 'deck-boundary') ?? null;
}

function commit(next, label) {
  documentModel = history.execute(documentModel, replaceDocument(next, label));
  persist();
  render();
}

function commitBoundary(nextBoundary, label) {
  commit(upsertObject(documentModel, nextBoundary), label);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, serializeProject(documentModel));
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function screenToWorld(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function render() {
  const current = boundary();
  const validation = current ? validateDeckBoundary(current) : null;
  const progress = deriveModelProgress(documentModel);
  const lifecycle = current ? getBoundaryLifecycle(current) : null;
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark">CME</div><div class="brand-copy"><div class="brand-name">Construction Modeling Engine</div><div class="brand-subtitle">${progress.stage.label} · One evolving project</div></div></div>
        <div class="project-name"><span class="saved-dot"></span>${escapeHtml(documentModel.name)} <span style="color:var(--muted);font-weight:500">· Saved locally</span></div>
        <div class="top-actions"><button class="button ghost" data-action="export">Export project</button><button class="button ${lifecycle?.phase === 'established' ? '' : 'primary'}" data-action="finish" ${!current || !validation.valid || lifecycle?.phase === 'established' ? 'disabled' : ''}>${lifecycle?.phase === 'established' ? 'Boundary established' : 'Establish boundary'}</button></div>
      </header>
      <section class="workspace-shell">
        <nav class="toolrail" aria-label="Modeling tools">
          <button class="tool-button ${mode === 'select' ? 'active' : ''}" data-mode="select" title="Select and edit"><span class="tool-icon">↖</span><span class="tool-label">Select</span></button>
          <button class="tool-button ${mode === 'draw' ? 'active' : ''}" data-mode="draw" title="Draw a custom deck boundary"><span class="tool-icon">◇</span><span class="tool-label">Boundary</span></button>
          <button class="tool-button ${mode === 'stair' ? 'active' : ''}" data-mode="stair" title="Attach stairs to a boundary edge" ${!current ? 'disabled' : ''}><span class="tool-icon">▰</span><span class="tool-label">Stairs</span></button>
          <div class="tool-spacer"></div>
          <button class="tool-button" data-action="toggle-inspector" title="Project details"><span class="tool-icon">☷</span><span class="tool-label">Details</span></button>
        </nav>
        <section class="canvas-panel">
          <div class="canvas-toolbar">
            <button class="button icon-button ghost" data-action="undo" aria-label="Undo" ${!history.canUndo ? 'disabled' : ''}>↶</button>
            <button class="button icon-button ghost" data-action="redo" aria-label="Redo" ${!history.canRedo ? 'disabled' : ''}>↷</button>
            <span class="divider"></span>
            <button class="button ghost" data-mode="select">Edit corners</button>
            <button class="button ${mode === 'draw' ? 'primary' : 'ghost'}" data-mode="draw">Draw outline</button>
            ${draft.length >= 3 ? '<button class="button primary" data-action="complete-draft">Close boundary</button>' : ''}
          </div>
          <svg class="model-canvas ${mode === 'draw' ? 'drawing' : ''}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" aria-label="Deck boundary modeling workspace"></svg>
          <div class="cursor-hud" aria-live="polite"><div class="hud-row"><span>Length</span><strong data-hud-length>—</strong></div><div class="hud-row"><span>Angle</span><strong data-hud-angle>—</strong></div><div class="hud-row snap"><span data-hud-snap-dot></span><strong data-hud-snap>Grid</strong></div><div class="hud-input" data-hud-input>Type a length</div></div>
          <div class="stair-live-hud" aria-live="polite"><div class="stair-live-label">TOTAL RISE</div><strong data-stair-live-rise>0″</strong><div class="stair-live-grid"><span><b data-stair-live-risers>—</b> risers</span><span><b data-stair-live-treads>—</b> treads</span><span><b data-stair-live-riser>—</b> each rise</span><span><b data-stair-live-tread>—</b> each tread</span></div><small>Release to build · 7.5″ max rise · 11″ max tread</small></div>
          <div class="statusbar"><div class="status-pill">${escapeHtml(message)}</div><div class="status-pill"><strong>${gridSetting === 'auto' ? 'Adaptive' : `${gridSetting}″`} grid</strong> · Wheel zoom · Right-drag pan · Middle double-click fit</div></div>
        </section>
        <aside class="inspector open">${renderProgress(progress, current)}${renderInspector(current, validation)}${renderGridControls()}</aside>
      </section>
    </main>`;
  bindEvents();
  drawCanvas(app.querySelector('.model-canvas'), current, validation);
}

function renderProgress(progress, current) {
  const established = current && getBoundaryLifecycle(current).phase === 'established';
  const atFinalStage = progress.stage.id === progress.nextStage.id;
  return `<section class="inspector-section progress-section"><div class="eyebrow">Progressive model</div><div class="progress-heading"><h2>${progress.stage.label}</h2><span class="level-badge">Level ${documentModel.workflow?.detailLevel ?? 1}</span></div><p class="section-copy">${progress.stage.description}</p><div class="maturity-track">${progress.milestones.map((milestone) => `<div class="maturity-step ${milestone.state}"><span></span><small>${milestone.label}</small></div>`).join('')}</div>${established && !atFinalStage ? `<button class="button progress-action" data-action="advance-stage">Continue to ${progress.nextStage.label.toLowerCase()}</button>` : ''}<div class="continuity-note">Same project · no redraw required</div></section>`;
}

function renderGridControls() {
  return `<section class="inspector-section"><div class="eyebrow">Workspace</div><h2>Construction grid</h2><p class="section-copy">Grid density adapts as you navigate. Choose a fixed field increment when needed.</p><div class="field-grid"><div class="field full"><label for="grid-spacing">Snap increment</label><select id="grid-spacing"><option value="auto" ${gridSetting === 'auto' ? 'selected' : ''}>Adaptive view · ½″ precision</option>${[.5, 1, 2, 6, 12, 24].map((value) => `<option value="${value}" ${String(value) === String(gridSetting) ? 'selected' : ''}>${value} inch${value === 1 ? '' : 'es'}</option>`).join('')}</select></div></div><label class="toggle-row"><input id="grid-visible" type="checkbox" ${gridVisible ? 'checked' : ''}><span>Show construction grid</span></label><div class="action-stack"><button class="button" data-action="fit-project">Fit project to view</button></div></section>`;
}

function renderInspector(current, validation) {
  if (!current) return `
    <section class="inspector-section empty-panel"><div class="eyebrow">First construction object</div><div class="empty-symbol">◇</div><h2>Define the deck surface</h2><p class="section-copy">Start from field dimensions or draw a custom outline. The finished boundary becomes part of the project model.</p></section>
    <section class="inspector-section"><div class="eyebrow">Fast start</div><h2>Rectangle deck</h2><p class="section-copy">Enter the outside dimensions of the walkable surface.</p><div class="field-grid"><div class="field"><label for="width">Width (ft)</label><input id="width" type="number" min="1" step="0.5" value="16"></div><div class="field"><label for="depth">Depth (ft)</label><input id="depth" type="number" min="1" step="0.5" value="12"></div></div><div class="action-stack"><button class="button primary" data-action="create-rectangle">Create deck boundary</button><button class="button" data-mode="draw">Draw a custom outline</button></div><div class="hint-card">Measure the outside edge of the finished walking surface. Structural framing will connect to this boundary in future tools.</div></section>`;
  const selectedEdge = selected.kind === 'edge' ? current.edges.find((edge) => edge.id === selected.id) : null;
  const selectedVertex = selected.kind === 'vertex' ? current.vertices.find((vertex) => vertex.id === selected.id) : null;
  const selectedStair = selected.kind === 'stair' ? documentModel.objects.find((object) => object.type === 'stair' && object.id === selected.id) : null;
  const lifecycle = getBoundaryLifecycle(current);
  const firstIssue = validation.issues[0];
  return `
    <section class="inspector-section"><div class="object-status"><div><div class="eyebrow">Deck Boundary</div><h2>${escapeHtml(current.name)}</h2></div><span class="object-badge ${lifecycle.phase}">${lifecycle.phase === 'established' ? 'Authoritative' : 'Review'}</span></div><p class="section-copy">${lifecycle.phase === 'established' ? 'The authoritative walkable surface. Continue refining it as project detail grows.' : 'A completed sketch awaiting field confirmation before it becomes authoritative.'}</p><div class="metric-grid"><div class="metric"><div class="metric-label">Surface area</div><div class="metric-value">${formatSquareFeet(current.computed.areaSquareInches)}</div></div><div class="metric"><div class="metric-label">Perimeter</div><div class="metric-value">${formatFeetInches(current.computed.perimeterInches)}</div></div><div class="metric"><div class="metric-label">Corners</div><div class="metric-value">${current.vertices.length}</div></div><div class="metric"><div class="metric-label">Revision</div><div class="metric-value">${lifecycle.revision}</div></div></div><div class="validation ${validation.valid ? '' : 'error'}"><span class="validation-dot"></span><span>${validation.valid ? lifecycle.phase === 'established' ? 'Construction object is valid and remains fully editable.' : 'Sketch is valid. Establish it when field measurements are confirmed.' : escapeHtml(firstIssue?.message ?? 'Boundary needs attention.')}</span></div></section>
    ${selectedEdge ? renderEdgeInspector(current, selectedEdge) : ''}
    ${stairDraft && selectedEdge ? renderStairInspector(current, selectedEdge) : ''}
    ${selectedStair ? renderStairObjectInspector(selectedStair) : ''}
    ${selectedVertex ? `<section class="inspector-section"><div class="eyebrow">Selected corner</div><h2>Geometry corner</h2><p class="section-copy">Drag freely, or place this corner over a neighboring corner to merge them and remove the redundant edge.</p><div class="vertex-guidance"><span class="merge-symbol"></span><span>Neighboring corners glow when a valid merge is available.</span></div><div class="action-stack"><button class="button danger" data-action="delete-vertex" ${current.vertices.length <= 3 ? 'disabled' : ''}>Remove corner</button></div></section>` : ''}
    <section class="inspector-section"><div class="eyebrow">Project model</div><h2>Ready for future objects</h2><p class="section-copy">Edges and corners keep stable identities for house attachments, stairs, railings, fascia, framing, and takeoff.</p><div class="action-stack"><button class="button" data-action="new-boundary">Start over</button></div></section>`;
}

function renderStairObjectInspector(stair) {
  const riserCount = stair.dimensions.riserCount ?? stair.dimensions.stepCount;
  const treadCount = stair.dimensions.treadCount ?? Math.max(1, riserCount - 1);
  return `<section class="inspector-section stair-panel"><div class="object-status"><div><div class="eyebrow">Stair construction object</div><h2>${escapeHtml(stair.name)}</h2></div><span class="object-badge established">Attached</span></div><p class="section-copy">Generated from the authoritative Deck Boundary. The deck surface is the upper landing, so the final transition from the last tread counts as a riser.</p><div class="metric-grid"><div class="metric"><div class="metric-label">Total rise</div><div class="metric-value">${formatFeetInches(stair.dimensions.totalRise)}</div></div><div class="metric"><div class="metric-label">Total run</div><div class="metric-value">${formatFeetInches(stair.dimensions.totalRun)}</div></div><div class="metric"><div class="metric-label">Risers</div><div class="metric-value">${riserCount} × ${formatFeetInches(stair.dimensions.riserHeight)}</div></div><div class="metric"><div class="metric-label">Treads</div><div class="metric-value">${treadCount} × ${formatFeetInches(stair.dimensions.treadDepth)}</div></div></div><div class="validation"><span class="validation-dot"></span><span>Each riser is 7.5″ or less and each tread is 11″ or less.</span></div></section>`;
}

function renderEdgeInspector(current, edge) {
  const normalized = normalizeBoundaryEdge(edge);
  const index = current.edges.findIndex((entry) => entry.id === edge.id);
  const start = current.vertices[index];
  const end = current.vertices[(index + 1) % current.vertices.length];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const properties = normalized.properties;
  return `<section class="inspector-section edge-inspector"><div class="object-status"><div><div class="eyebrow">Construction edge</div><h2>${formatFeetInches(length)}</h2></div><span class="object-badge established">Independent</span></div><p class="section-copy">Drag the edge to move it, or refine it with exact construction dimensions.</p><div class="field-grid"><div class="field full"><label for="edge-length">Exact edge length</label><div class="compound-field"><input id="edge-length" value="${formatFeetInches(length)}"><button class="button" data-action="apply-edge-length">Apply</button></div></div><div class="field full"><label for="edge-offset">Move perpendicular</label><div class="compound-field"><input id="edge-offset" placeholder="6 in"><button class="button" data-action="apply-edge-offset">Move</button></div></div></div><div class="constraint-row"><button class="button ${properties.custom.geometricConstraint === 'horizontal' ? 'active-constraint' : ''}" data-action="constraint-horizontal">Horizontal</button><button class="button ${properties.custom.geometricConstraint === 'vertical' ? 'active-constraint' : ''}" data-action="constraint-vertical">Vertical</button></div><div class="property-list"><label><input type="checkbox" data-edge-property="fascia" ${properties.finishes.fascia ? 'checked' : ''}><span><strong>Fascia</strong><small>Exterior finish board</small></span></label><label><input type="checkbox" data-edge-property="pictureFrame" ${properties.finishes.pictureFrame ? 'checked' : ''}><span><strong>Picture frame</strong><small>Decking board along edge</small></span></label><label><input type="checkbox" data-edge-property="demolition" ${properties.existingConditions.demolition ? 'checked' : ''}><span><strong>Demolition</strong><small>Existing edge to remove</small></span></label></div><div class="field-grid"><div class="field full"><label for="edge-role">Construction relationship</label><select id="edge-role"><option value="open" ${edge.role === 'open' ? 'selected' : ''}>Unassigned</option><option value="house" ${edge.role === 'house' ? 'selected' : ''}>House attachment</option><option value="free-edge" ${edge.role === 'free-edge' ? 'selected' : ''}>Open deck edge</option></select></div><div class="field full"><label for="edge-railing">Railing intent</label><select id="edge-railing"><option value="unassigned" ${properties.safety.railing === 'unassigned' ? 'selected' : ''}>Unassigned</option><option value="required" ${properties.safety.railing === 'required' ? 'selected' : ''}>Railing required</option><option value="existing" ${properties.safety.railing === 'existing' ? 'selected' : ''}>Existing railing</option></select></div></div><div class="action-stack"><button class="button" data-action="insert-midpoint">Insert corner at midpoint</button><button class="button primary" data-action="start-stair">Attach staircase</button></div></section>`;
}

function renderStairInspector(current, edge) {
  return `<section class="inspector-section stair-panel"><div class="eyebrow">Live stair placement</div><h2>Press and drag outward</h2><p class="section-copy">Start on this construction edge and pull away from the deck. Treads and risers will appear immediately; release when the displayed total rise matches the field measurement.</p><div class="stair-limit-list"><span><strong>7.5″</strong> maximum riser</span><span><strong>11″</strong> maximum tread</span><span><strong>Deck</strong> is the upper landing</span></div><div class="action-stack"><button class="button" data-action="cancel-stair">Cancel stair tool</button></div></section>`;
}

function drawCanvas(svg, current, validation) {
  svg.setAttribute('viewBox', `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);
  const visibleGrid = gridSetting === 'auto' ? adaptiveGridSpacing(viewport.width, svg.clientWidth || 1000) : Number(gridSetting);
  const majorGrid = visibleGrid * 4;
  const defs = svgElement('defs');
  const minor = svgElement('pattern', { id: 'minorGrid', width: visibleGrid, height: visibleGrid, patternUnits: 'userSpaceOnUse' });
  minor.append(svgElement('path', { d: `M ${visibleGrid} 0 L 0 0 0 ${visibleGrid}`, class: 'grid-minor', fill: 'none' }));
  const major = svgElement('pattern', { id: 'majorGrid', width: majorGrid, height: majorGrid, patternUnits: 'userSpaceOnUse' });
  major.append(svgElement('rect', { width: majorGrid, height: majorGrid, fill: 'url(#minorGrid)' }), svgElement('path', { d: `M ${majorGrid} 0 L 0 0 0 ${majorGrid}`, class: 'grid-major', fill: 'none' }));
  defs.append(minor, major);
  svg.append(defs, svgElement('rect', { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height, fill: gridVisible ? 'url(#majorGrid)' : '#0d1114' }));
  svg.append(svgElement('line', { x1: viewport.x, y1: '0', x2: viewport.x + viewport.width, y2: '0', class: 'axis-line' }), svgElement('line', { x1: '0', y1: viewport.y, x2: '0', y2: viewport.y + viewport.height, class: 'axis-line' }));
  if (current) {
    renderBoundarySvg(svg, current, validation);
    renderStairGraphics(svg, current);
    renderStairPreview(svg, current);
  }
  if (draft.length) renderDraft(svg);
}

function renderStairGraphics(svg, current) {
  documentModel.objects.filter((object) => object.type === 'stair' && object.host.boundaryId === current.id).forEach((stair) => renderStairShape(svg, current, stair, false));
}

function renderStairPreview(svg, current) {
  if (!stairDraft || !selected.id || !stairDraft.totalRise) return;
  const options = { ...stairDraft };
  if (!validateStairPlacement(current, selected.id, options).valid) return;
  let count = 0;
  try {
    const preview = attachStairToBoundary(current, selected.id, options, (prefix) => `preview-${prefix}-${++count}`);
    renderStairShape(svg, preview.boundary, preview.stair, true);
  } catch { /* Inspector communicates invalid planning dimensions. */ }
}

function renderStairShape(svg, current, stair, preview) {
  const byId = new Map(current.vertices.map((vertex) => [vertex.id, vertex]));
  const ids = stair.anchors;
  const polygonPoints = [ids.openingStartVertexId, ids.outerStartVertexId, ids.outerEndVertexId, ids.openingEndVertexId]
    .map((id) => byId.get(id)).filter(Boolean);
  if (polygonPoints.length !== 4) return;
  svg.append(svgElement('polygon', { points: polygonPoints.map((point) => `${point.x},${point.y}`).join(' '), class: preview ? 'stair-preview-fill' : 'stair-construction-fill' }));
  deriveStairTreads(current, stair).forEach((tread, index) => {
    svg.append(svgElement('line', { x1: tread.start.x, y1: tread.start.y, x2: tread.end.x, y2: tread.end.y, class: preview ? 'stair-preview-tread' : 'stair-tread', 'data-step': index + 1 }));
  });
}

function renderBoundarySvg(svg, current, validation) {
  const points = current.vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
  svg.append(svgElement('polygon', { points, class: `boundary-fill ${validation.valid ? '' : 'invalid'}` }));
  current.edges.forEach((edge, index) => {
    const start = current.vertices[index];
    const end = current.vertices[(index + 1) % current.vertices.length];
    renderEdgeConstructionGraphics(svg, current, start, end, normalizeBoundaryEdge(edge).properties);
    const selectedClass = selected.kind === 'edge' && selected.id === edge.id ? 'selected' : '';
    svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `boundary-edge-visible ${edge.role} ${selectedClass}` }));
    const hit = svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'boundary-edge', 'data-edge-id': edge.id });
    svg.append(hit);
    addDimension(svg, start, end);
  });
  const markerSize = Math.max(2.8, viewport.width / 150);
  const hitSize = viewport.width / Math.max(svg.clientWidth || 1000, 1) * 34;
  current.vertices.forEach((vertex) => {
    svg.append(svgElement('rect', { x: vertex.x - hitSize / 2, y: vertex.y - hitSize / 2, width: hitSize, height: hitSize, class: 'vertex-hit', 'data-vertex-id': vertex.id }));
    svg.append(svgElement('rect', { x: vertex.x - markerSize / 2, y: vertex.y - markerSize / 2, width: markerSize, height: markerSize, rx: markerSize * .12, class: `vertex ${selected.kind === 'vertex' && selected.id === vertex.id ? 'selected' : ''} ${mergeCandidateId === vertex.id ? 'merge-ready' : ''}`, transform: `rotate(45 ${vertex.x} ${vertex.y})` }));
  });
}

function renderEdgeConstructionGraphics(svg, current, start, end, properties) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const signedArea = current.vertices.reduce((sum, vertex, index) => {
    const next = current.vertices[(index + 1) % current.vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
  const interiorSign = signedArea >= 0 ? 1 : -1;
  const interior = { x: -dy / length * interiorSign, y: dx / length * interiorSign };
  if (properties.finishes.pictureFrame) {
    svg.append(svgElement('line', { x1: start.x + interior.x * 3, y1: start.y + interior.y * 3, x2: end.x + interior.x * 3, y2: end.y + interior.y * 3, class: 'picture-frame-board' }));
  }
  if (properties.finishes.fascia) {
    svg.append(svgElement('line', { x1: start.x - interior.x * 1.5, y1: start.y - interior.y * 1.5, x2: end.x - interior.x * 1.5, y2: end.y - interior.y * 1.5, class: 'fascia-board' }));
  }
  if (properties.existingConditions.demolition) {
    svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'demolition-edge' }));
  }
  if (properties.safety.railing === 'required' || properties.safety.railing === 'existing') {
    const postCount = Math.max(2, Math.ceil(length / 48) + 1);
    for (let index = 0; index < postCount; index += 1) {
      const t = index / (postCount - 1);
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      svg.append(svgElement('rect', { x: x - 2, y: y - 2, width: 4, height: 4, class: `railing-post ${properties.safety.railing}` }));
    }
  }
}

function addDimension(svg, start, end) {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 12) return;
  const offsetX = (-dy / length) * 8;
  const offsetY = (dx / length) * 8;
  const label = formatFeetInches(length);
  const width = Math.max(25, label.length * 3.3);
  svg.append(svgElement('rect', { x: midX + offsetX - width / 2, y: midY + offsetY - 4, width, height: 8, rx: 2, class: 'dimension-bg' }));
  const text = svgElement('text', { x: midX + offsetX, y: midY + offsetY + .3, class: 'dimension-text' });
  text.textContent = label;
  svg.append(text);
}

function renderDraft(svg) {
  const points = [...draft, ...(pointerWorld ? [pointerWorld] : [])];
  svg.append(svgElement('polyline', { points: points.map((entry) => `${entry.x},${entry.y}`).join(' '), fill: 'none', class: 'preview-line' }));
  const markerSize = Math.max(2.8, viewport.width / 150);
  draft.forEach((vertex, index) => svg.append(svgElement('rect', { x: vertex.x - markerSize / 2, y: vertex.y - markerSize / 2, width: markerSize, height: markerSize, class: `vertex ${index === 0 ? 'start' : ''}`, transform: `rotate(45 ${vertex.x} ${vertex.y})`, 'data-draft-index': index })));
  if (pointerWorld && draft.length) {
    const anchor = draft[draft.length - 1];
    if (snapState.guides.includes('vertical')) svg.append(svgElement('line', { x1: pointerWorld.x, y1: viewport.y, x2: pointerWorld.x, y2: viewport.y + viewport.height, class: 'guide-line' }));
    if (snapState.guides.includes('horizontal')) svg.append(svgElement('line', { x1: viewport.x, y1: pointerWorld.y, x2: viewport.x + viewport.width, y2: pointerWorld.y, class: 'guide-line' }));
  }
}

function bindEvents() {
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  app.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));
  const role = app.querySelector('#edge-role');
  if (role) role.addEventListener('change', () => commitBoundary(markBoundaryEdited(setEdgeRole(boundary(), selected.id, role.value)), 'Set edge relationship'));
  const railing = app.querySelector('#edge-railing');
  if (railing) railing.addEventListener('change', () => { message = 'Railing intent updated'; commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { safety: { railing: railing.value } })), 'Update edge railing intent'); });
  app.querySelectorAll('[data-edge-property]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.edgeProperty;
    const patch = key === 'demolition' ? { existingConditions: { demolition: input.checked } } : { finishes: { [key]: input.checked } };
    message = `${key} property updated`;
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, patch)), 'Update edge construction properties');
  }));
  const gridSpacing = app.querySelector('#grid-spacing');
  if (gridSpacing) gridSpacing.addEventListener('change', () => { gridSetting = gridSpacing.value; render(); });
  const gridVisibility = app.querySelector('#grid-visible');
  if (gridVisibility) gridVisibility.addEventListener('change', () => { gridVisible = gridVisibility.checked; render(); });
  const svg = app.querySelector('.model-canvas');
  svg.addEventListener('pointerdown', (event) => canvasPointerDown(svg, event));
  svg.addEventListener('pointermove', (event) => canvasPointerMove(svg, event));
  svg.addEventListener('pointerup', (event) => finishPointerGesture(svg, event));
  svg.addEventListener('pointercancel', (event) => finishPointerGesture(svg, event));
  svg.addEventListener('wheel', (event) => zoomAtPointer(svg, event), { passive: false });
  svg.addEventListener('contextmenu', (event) => event.preventDefault());
  svg.addEventListener('dblclick', (event) => edgeDoubleClick(svg, event));
}

function setMode(nextMode) {
  mode = nextMode;
  numericBuffer = '';
  stairGesture = null;
  if (mode !== 'stair') stairDraft = null;
  if (mode !== 'draw') { draft = []; pointerWorld = null; message = 'Ready'; }
  if (mode === 'draw') message = 'Click the first corner of the deck';
  if (mode === 'stair') message = 'Press a boundary edge and drag outward to build stairs';
  render();
}

function canvasPointerDown(svg, event) {
  const vertexId = event.target.dataset.vertexId;
  const edgeId = event.target.dataset.edgeId;
  if (event.pointerType === 'touch' && !((mode === 'select' && (vertexId || edgeId)) || (mode === 'stair' && edgeId))) {
    event.preventDefault();
    activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);
    if (activeTouches.size === 2) {
      pendingTouch = null;
      panGesture = null;
      const [first, second] = [...activeTouches.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      touchGesture = { viewport: { ...viewport }, center, worldAnchor: screenToWorld(svg, { clientX: center.x, clientY: center.y }), distance: Math.hypot(second.x - first.x, second.y - first.y) };
      return;
    }
    if (mode === 'draw') pendingTouch = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    else {
      panGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport: { ...viewport }, touch: true };
      svg.classList.add('panning');
    }
    return;
  }
  if (event.button === 2) {
    event.preventDefault();
    panGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport: { ...viewport } };
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('panning');
    hideHud();
    return;
  }
  if (event.button === 1) {
    event.preventDefault();
    const now = performance.now();
    if (now - lastMiddleClick < 350) fitProject(svg);
    lastMiddleClick = now;
    return;
  }
  if (mode === 'select' && vertexId) {
    selected = { kind: 'vertex', id: vertexId };
    draggingVertexId = vertexId;
    dragStartDocument = documentModel;
    mergeCandidateId = null;
    svg.setPointerCapture(event.pointerId);
    drawCanvasRefresh();
    return;
  }
  if (mode === 'select' && edgeId) {
    selected = { kind: 'edge', id: edgeId };
    draggingEdgeId = edgeId;
    edgeDragStart = { document: documentModel, boundary: boundary(), point: screenToWorld(svg, event), moved: false };
    svg.setPointerCapture(event.pointerId);
    drawCanvasRefresh();
    return;
  }
  if (mode === 'stair' && edgeId) {
    const current = boundary();
    const edgeIndex = current.edges.findIndex((edge) => edge.id === edgeId);
    const edgeLength = Math.hypot(
      current.vertices[(edgeIndex + 1) % current.vertices.length].x - current.vertices[edgeIndex].x,
      current.vertices[(edgeIndex + 1) % current.vertices.length].y - current.vertices[edgeIndex].y,
    );
    selected = { kind: 'edge', id: edgeId };
    stairGesture = { pointerId: event.pointerId, edgeId, width: Math.min(36, Math.max(24, edgeLength - 12)) };
    stairDraft = { edgeId, width: stairGesture.width, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0, dragging: true };
    message = 'Drag outward · watch TOTAL RISE · release to build';
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('stairing');
    updateStairLiveHud();
    drawCanvasRefresh();
    return;
  }
  if (mode !== 'draw') { selected = { kind: null, id: null }; render(); return; }
  placeDraftPoint(screenToWorld(svg, event));
}

function placeDraftPoint(raw) {
  const snapped = snapForPointer(raw, draft[draft.length - 1]);
  if (draft.length >= 3 && Math.hypot(snapped.point.x - draft[0].x, snapped.point.y - draft[0].y) < 5) { completeDraft(); return; }
  draft.push(snapped.point);
  numericBuffer = '';
  message = draft.length < 3 ? 'Continue to the next corner' : 'Click the first corner or press Enter to close';
  render();
}

function canvasPointerMove(svg, event) {
  if (event.pointerType === 'touch' && activeTouches.has(event.pointerId)) {
    activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pendingTouch?.pointerId === event.pointerId) {
      pendingTouch.x = event.clientX;
      pendingTouch.y = event.clientY;
      pendingTouch.moved ||= Math.hypot(event.clientX - pendingTouch.startX, event.clientY - pendingTouch.startY) > 8;
    }
    if (touchGesture && activeTouches.size >= 2) {
      const [first, second] = [...activeTouches.values()];
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const currentDistance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const zoomed = zoomViewport(touchGesture.viewport, touchGesture.worldAnchor, touchGesture.distance / currentDistance);
      viewport = panViewport(zoomed, {
        x: -(center.x - touchGesture.center.x) * zoomed.width / svg.clientWidth,
        y: -(center.y - touchGesture.center.y) * zoomed.height / svg.clientHeight,
      });
      drawCanvasRefresh();
      return;
    }
  }
  if (panGesture?.pointerId === event.pointerId) {
    const dx = -(event.clientX - panGesture.startX) * panGesture.viewport.width / svg.clientWidth;
    const dy = -(event.clientY - panGesture.startY) * panGesture.viewport.height / svg.clientHeight;
    viewport = panViewport(panGesture.viewport, { x: dx, y: dy });
    drawCanvasRefresh();
    return;
  }
  const raw = screenToWorld(svg, event);
  if (stairGesture?.pointerId === event.pointerId) {
    const options = deriveStairDragOptions(boundary(), stairGesture.edgeId, raw, stairGesture.width);
    stairDraft = options
      ? { edgeId: stairGesture.edgeId, ...options, dragging: true }
      : { edgeId: stairGesture.edgeId, width: stairGesture.width, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0, dragging: true };
    message = options ? `${formatFeetInches(options.totalRise)} total rise · release to build` : 'Drag outward from the deck edge';
    drawCanvasRefresh();
    updateStairLiveHud(event);
    updateStatusMessage();
    return;
  }
  if (draggingEdgeId && edgeDragStart) {
    const original = edgeDragStart.boundary;
    const edgeIndex = original.edges.findIndex((edge) => edge.id === draggingEdgeId);
    const start = original.vertices[edgeIndex];
    const end = original.vertices[(edgeIndex + 1) % original.vertices.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
    const offset = (raw.x - edgeDragStart.point.x) * normal.x + (raw.y - edgeDragStart.point.y) * normal.y;
    if (Math.abs(offset) > viewport.width / svg.clientWidth * 3) edgeDragStart.moved = true;
    const moved = offsetEdge(original, draggingEdgeId, offset);
    documentModel = upsertObject(edgeDragStart.document, moved);
    persist();
    drawCanvasRefresh();
    return;
  }
  if (draggingVertexId && boundary()) {
    const current = boundary();
    const index = current.vertices.findIndex((vertex) => vertex.id === draggingVertexId);
    const anchor = current.vertices[(index - 1 + current.vertices.length) % current.vertices.length];
    const adjacentIds = new Set([draggingVertexId, current.edges[index]?.id, current.edges[(index - 1 + current.edges.length) % current.edges.length]?.id]);
    const snapped = snapForPointer(raw, anchor, [], adjacentIds);
    const tolerance = viewport.width / Math.max(svg.clientWidth, 1) * 14;
    mergeCandidateId = findAdjacentMergeCandidate(current, draggingVertexId, snapped.point, tolerance)?.id ?? null;
    if (mergeCandidateId) message = 'Release to merge neighboring corners';
    documentModel = upsertObject(documentModel, updateVertex(current, draggingVertexId, snapped.point));
    persist();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'draw') {
    snapState = snapForPointer(raw, draft[draft.length - 1]);
    pointerWorld = snapState.point;
    drawCanvasRefresh();
    updateHud(event);
  } else {
    hideHud();
  }
}

function drawCanvasRefresh() {
  const svg = app.querySelector('.model-canvas');
  svg.innerHTML = '';
  const current = boundary();
  drawCanvas(svg, current, current ? validateDeckBoundary(current) : null);
}

function finishPointerGesture(svg, event) {
  if (event.pointerType === 'touch') {
    const shouldPlace = pendingTouch?.pointerId === event.pointerId && !pendingTouch.moved && !touchGesture;
    const placement = pendingTouch ? { clientX: pendingTouch.x, clientY: pendingTouch.y } : null;
    activeTouches.delete(event.pointerId);
    if (pendingTouch?.pointerId === event.pointerId) pendingTouch = null;
    if (activeTouches.size < 2) touchGesture = null;
    if (shouldPlace && placement) placeDraftPoint(screenToWorld(svg, placement));
  }
  if (panGesture) {
    panGesture = null;
    app.querySelector('.model-canvas')?.classList.remove('panning');
  }
  if (stairGesture?.pointerId === event.pointerId) {
    const options = stairDraft;
    stairGesture = null;
    app.querySelector('.model-canvas')?.classList.remove('stairing');
    if (event.type === 'pointercancel' || !options?.totalRise || options.totalRun < 12) {
      stairDraft = null;
      message = event.type === 'pointercancel' ? 'Stair placement canceled' : 'Drag at least 12 inches outward to build stairs';
      render();
      return;
    }
    try {
      const attached = attachStairToBoundary(boundary(), options.edgeId, options);
      let next = upsertObject(documentModel, markBoundaryEdited(attached.boundary));
      next = upsertObject(next, attached.stair);
      selected = { kind: 'stair', id: attached.stair.id };
      stairDraft = null;
      mode = 'select';
      message = `${attached.stair.dimensions.riserCount} risers · ${attached.stair.dimensions.treadCount} treads · staircase added`;
      commit(next, 'Drag staircase from Deck Boundary');
    } catch (error) {
      stairDraft = null;
      message = error.message;
      render();
    }
    return;
  }
  if (draggingVertexId && dragStartDocument && dragStartDocument !== documentModel) {
    if (mergeCandidateId) {
      if (isVertexReferencedByAttachment(draggingVertexId)) {
        documentModel = dragStartDocument;
        message = 'This corner anchors an attached construction object and cannot merge yet';
        mergeCandidateId = null;
        render();
      } else {
        try {
          const merge = mergeAdjacentVertices(boundary(), draggingVertexId, mergeCandidateId);
          let finalDocument = upsertObject(documentModel, markBoundaryEdited(merge.boundary));
          finalDocument = remapEdgeReferences(finalDocument, merge.removedEdgeId, merge.survivingEdgeId);
          documentModel = dragStartDocument;
          selected = { kind: 'vertex', id: merge.targetVertexId };
          message = 'Corners merged · redundant edge removed · properties preserved';
          mergeCandidateId = null;
          commit(finalDocument, 'Merge boundary corners');
        } catch (error) {
          documentModel = dragStartDocument;
          message = error.message;
          mergeCandidateId = null;
          render();
        }
      }
    } else {
      const editedBoundary = markBoundaryEdited(boundary());
      const finalDocument = upsertObject(documentModel, editedBoundary);
      documentModel = dragStartDocument;
      message = 'Boundary corner moved';
      commit(finalDocument, 'Move boundary corner');
    }
  }
  if (draggingEdgeId && edgeDragStart) {
    if (edgeDragStart.moved) {
      const finalDocument = upsertObject(documentModel, markBoundaryEdited(boundary()));
      documentModel = edgeDragStart.document;
      message = 'Construction edge moved';
      commit(finalDocument, 'Move boundary edge');
    } else render();
  }
  draggingVertexId = null;
  dragStartDocument = null;
  draggingEdgeId = null;
  edgeDragStart = null;
  mergeCandidateId = null;
}

function isVertexReferencedByAttachment(vertexId) {
  return documentModel.objects.some((object) => object.type === 'stair' && Object.values(object.anchors ?? {}).includes(vertexId));
}

function remapEdgeReferences(document, removedEdgeId, survivingEdgeId) {
  return {
    ...document,
    objects: document.objects.map((object) => {
      if (object.type !== 'stair') return object;
      return {
        ...object,
        host: object.host.sourceEdgeId === removedEdgeId ? { ...object.host, sourceEdgeId: survivingEdgeId } : object.host,
        generatedEdgeIds: object.generatedEdgeIds?.map((id) => id === removedEdgeId ? survivingEdgeId : id),
      };
    }),
  };
}

function snapForPointer(raw, anchor, extraVertices = [], excludedIds = new Set()) {
  const objects = boundary() ? [boundary()] : [];
  const draftObject = { vertices: [...draft, ...extraVertices], edges: [] };
  const tolerance = viewport.width / Math.max(app.querySelector('.model-canvas')?.clientWidth ?? 1000, 1) * 11;
  return resolveSnap(raw, {
    anchor,
    tolerance,
    grid: gridSetting === 'auto' ? .5 : Number(gridSetting),
    targets: collectSnapTargets([...objects, draftObject]).filter((target) => !excludedIds.has(target.referenceId)),
  });
}

function zoomAtPointer(svg, event) {
  event.preventDefault();
  const anchor = screenToWorld(svg, event);
  const target = zoomViewport(viewport, anchor, Math.exp(event.deltaY * .0012));
  animateViewport(target);
  hideHud();
}

function animateViewport(target) {
  const animationId = ++viewportAnimation;
  const start = { ...viewport };
  const startedAt = performance.now();
  const duration = 130;
  const frame = (now) => {
    if (animationId !== viewportAnimation) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    viewport = Object.fromEntries(Object.keys(start).map((key) => [key, start[key] + (target[key] - start[key]) * eased]));
    drawCanvasRefresh();
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function fitProject(svg = app.querySelector('.model-canvas')) {
  const points = [...(boundary()?.vertices ?? []), ...draft];
  const aspect = (svg?.clientWidth || 1000) / (svg?.clientHeight || 700);
  animateViewport(fitViewport(points, aspect));
  message = points.length ? 'Project fitted to workspace' : 'Workspace reset';
}

function edgeDoubleClick(svg, event) {
  if (mode !== 'select' || !event.target.dataset.edgeId) return;
  const current = boundary();
  const edgeId = event.target.dataset.edgeId;
  const edgeIndex = current.edges.findIndex((edge) => edge.id === edgeId);
  const raw = screenToWorld(svg, event);
  const projected = nearestPointOnSegment(raw, current.vertices[edgeIndex], current.vertices[(edgeIndex + 1) % current.vertices.length]);
  commitBoundary(markBoundaryEdited(insertVertex(current, edgeId, projected.point)), 'Add boundary corner');
  message = 'Corner added';
}

function completeDraft() {
  if (draft.length < 3) return;
  const nextBoundary = createDeckBoundary(draft);
  const validation = validateDeckBoundary(nextBoundary);
  if (!validation.valid) { message = validation.issues[0].message; render(); return; }
  commitBoundary(nextBoundary, 'Create deck boundary');
  draft = [];
  pointerWorld = null;
  numericBuffer = '';
  mode = 'select';
  message = 'Deck boundary created';
  render();
}

function handleAction(action) {
  if (action === 'create-rectangle') {
    const width = Number(app.querySelector('#width').value) * 12;
    const depth = Number(app.querySelector('#depth').value) * 12;
    if (width <= 0 || depth <= 0) return;
    const next = createDeckBoundary([{ x: 36, y: 36 }, { x: 36 + width, y: 36 }, { x: 36 + width, y: 36 + depth }, { x: 36, y: 36 + depth }]);
    commitBoundary(next, 'Create rectangular deck boundary');
    message = 'Deck boundary created from field dimensions';
  }
  if (action === 'complete-draft') completeDraft();
  if (action === 'apply-edge-length' && selected.kind === 'edge') {
    const length = parseConstructionLength(app.querySelector('#edge-length')?.value);
    if (!length) { message = 'Enter a valid construction length'; render(); }
    else { message = 'Edge length updated precisely'; commitBoundary(markBoundaryEdited(setEdgeLength(boundary(), selected.id, length)), 'Set boundary edge length'); }
  }
  if (action === 'apply-edge-offset' && selected.kind === 'edge') {
    const offset = parseConstructionLength(app.querySelector('#edge-offset')?.value);
    if (offset === null) { message = 'Enter an offset such as 6 in or -1 ft'; render(); }
    else { message = 'Construction edge moved'; commitBoundary(markBoundaryEdited(offsetEdge(boundary(), selected.id, offset)), 'Offset boundary edge'); }
  }
  if (action === 'constraint-horizontal' && selected.kind === 'edge') { message = 'Horizontal relation applied'; commitBoundary(markBoundaryEdited(constrainEdge(boundary(), selected.id, 'horizontal')), 'Constrain edge horizontal'); }
  if (action === 'constraint-vertical' && selected.kind === 'edge') { message = 'Vertical relation applied'; commitBoundary(markBoundaryEdited(constrainEdge(boundary(), selected.id, 'vertical')), 'Constrain edge vertical'); }
  if (action === 'insert-midpoint' && selected.kind === 'edge') {
    const current = boundary();
    const edgeIndex = current.edges.findIndex((edge) => edge.id === selected.id);
    const start = current.vertices[edgeIndex];
    const end = current.vertices[(edgeIndex + 1) % current.vertices.length];
    const existingVertexIds = new Set(current.vertices.map((vertex) => vertex.id));
    const inserted = markBoundaryEdited(insertVertex(current, selected.id, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }));
    const newVertex = inserted.vertices.find((vertex) => !existingVertexIds.has(vertex.id));
    selected = { kind: 'vertex', id: newVertex?.id ?? null };
    message = 'Corner inserted at the edge midpoint';
    commitBoundary(inserted, 'Insert boundary corner');
  }
  if (action === 'start-stair' && selected.kind === 'edge') {
    mode = 'stair';
    stairDraft = { edgeId: selected.id, width: 36, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0 };
    message = 'Press this edge and drag outward · release at the required total rise';
    render();
  }
  if (action === 'cancel-stair') { stairGesture = null; stairDraft = null; mode = 'select'; message = 'Stair placement canceled'; render(); }
  if (action === 'undo') { documentModel = history.undo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Undid last change'; render(); }
  if (action === 'redo') { documentModel = history.redo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Redid change'; render(); }
  if (action === 'delete-vertex' && selected.kind === 'vertex') { commitBoundary(markBoundaryEdited(removeVertex(boundary(), selected.id)), 'Remove boundary corner'); selected = { kind: null, id: null }; message = 'Corner removed'; }
  if (action === 'new-boundary') {
    const next = { ...documentModel, objects: documentModel.objects.filter((object) => object.type !== 'deck-boundary') };
    commit(next, 'Remove deck boundary'); selected = { kind: null, id: null }; mode = 'select'; message = 'Ready for a new boundary';
  }
  if (action === 'export') exportProject();
  if (action === 'finish' && boundary()) { message = 'Deck Boundary is now the authoritative project footprint'; commitBoundary(establishDeckBoundary(boundary()), 'Establish deck boundary'); }
  if (action === 'advance-stage') {
    const progress = deriveModelProgress(documentModel);
    if (progress.nextStage.id !== progress.stage.id) {
      message = `Project advanced to ${progress.nextStage.label}`;
      commit(setProjectWorkflowStage(documentModel, progress.nextStage.id), `Advance project to ${progress.nextStage.label}`);
    }
  }
  if (action === 'fit-project') fitProject();
  if (action === 'toggle-inspector') app.querySelector('.inspector')?.classList.toggle('open');
}

function exportProject() {
  const blob = new Blob([serializeProject(documentModel)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${documentModel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.cme.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  message = 'Project exported';
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
}

function updateHud(event) {
  const hud = app.querySelector('.cursor-hud');
  if (!hud || mode !== 'draw' || !draft.length || !pointerWorld) { hideHud(); return; }
  const panel = app.querySelector('.canvas-panel').getBoundingClientRect();
  hud.style.left = `${Math.min(panel.width - 180, event.clientX - panel.left + 18)}px`;
  hud.style.top = `${Math.min(panel.height - 120, event.clientY - panel.top + 18)}px`;
  hud.classList.add('visible');
  const anchor = draft[draft.length - 1];
  const dx = pointerWorld.x - anchor.x;
  const dy = pointerWorld.y - anchor.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  hud.querySelector('[data-hud-length]').textContent = formatFeetInches(Math.hypot(dx, dy));
  hud.querySelector('[data-hud-angle]').textContent = `${Math.round(angle)}°`;
  hud.querySelector('[data-hud-snap]').textContent = snapState.label;
  const input = hud.querySelector('[data-hud-input]');
  input.textContent = numericBuffer || 'Type a length · Enter';
  input.classList.toggle('active', Boolean(numericBuffer));
}

function hideHud() {
  app.querySelector('.cursor-hud')?.classList.remove('visible');
}

function updateStairLiveHud(event = null) {
  const hud = app.querySelector('.stair-live-hud');
  if (!hud) return;
  hud.classList.toggle('visible', Boolean(stairGesture));
  if (!stairGesture) return;
  if (event) {
    const panel = app.querySelector('.canvas-panel').getBoundingClientRect();
    hud.style.left = `${Math.max(14, Math.min(panel.width - 230, event.clientX - panel.left + 22))}px`;
    hud.style.top = `${Math.max(70, Math.min(panel.height - 190, event.clientY - panel.top - 72))}px`;
  }
  const options = stairDraft;
  hud.querySelector('[data-stair-live-rise]').textContent = options?.totalRise ? formatFeetInches(options.totalRise) : '0″';
  hud.querySelector('[data-stair-live-risers]').textContent = options?.riserCount || '—';
  hud.querySelector('[data-stair-live-treads]').textContent = options?.treadCount || '—';
  hud.querySelector('[data-stair-live-riser]').textContent = options?.riserHeight ? formatFeetInches(options.riserHeight) : '—';
  hud.querySelector('[data-stair-live-tread]').textContent = options?.treadDepth ? formatFeetInches(options.treadDepth) : '—';
}

function updateStatusMessage() {
  const status = app.querySelector('.status-pill');
  if (status) status.textContent = message;
}

function acceptNumericLength() {
  if (!draft.length || !numericBuffer) return false;
  const length = parseConstructionLength(numericBuffer);
  if (!length || length <= 0) { message = 'Use a length such as 12\', 144 in, or 3658 mm'; render(); return true; }
  const anchor = draft[draft.length - 1];
  const dx = (pointerWorld?.x ?? anchor.x + 1) - anchor.x;
  const dy = (pointerWorld?.y ?? anchor.y) - anchor.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const exactPoint = { x: anchor.x + dx / magnitude * length, y: anchor.y + dy / magnitude * length };
  draft.push(exactPoint);
  pointerWorld = exactPoint;
  lastLength = length;
  numericBuffer = '';
  message = `${formatFeetInches(length)} segment placed · continue drawing`;
  render();
  return true;
}

function repeatLastSegment() {
  if (!lastLength || !draft.length) return;
  const anchor = draft.at(-1);
  const previous = draft.at(-2);
  const dx = previous ? anchor.x - previous.x : 1;
  const dy = previous ? anchor.y - previous.y : 0;
  const magnitude = Math.hypot(dx, dy) || 1;
  draft.push({ x: anchor.x + dx / magnitude * lastLength, y: anchor.y + dy / magnitude * lastLength });
  message = `${formatFeetInches(lastLength)} segment repeated`;
  render();
}

window.addEventListener('keydown', (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); handleAction(event.shiftKey ? 'redo' : 'undo'); }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); handleAction('redo'); }
  if (mode === 'draw' && !modifier && /^[0-9a-z.'"\-]$/i.test(event.key)) {
    if (event.key.toLowerCase() === 'r' && !numericBuffer) { event.preventDefault(); repeatLastSegment(); return; }
    event.preventDefault(); numericBuffer += event.key; message = 'Enter an exact segment length'; updateHudFromKeyboard(); return;
  }
  if (mode === 'draw' && event.key === 'Backspace' && numericBuffer) { event.preventDefault(); numericBuffer = numericBuffer.slice(0, -1); updateHudFromKeyboard(); return; }
  if (event.key === 'Enter' && mode === 'draw') { event.preventDefault(); if (!acceptNumericLength()) completeDraft(); }
  if (event.key === ' ' && mode === 'draw') { event.preventDefault(); if (numericBuffer) { numericBuffer += ' '; updateHudFromKeyboard(); } else repeatLastSegment(); }
  if (event.key === 'Tab' && mode === 'draw') { event.preventDefault(); message = numericBuffer ? 'Press Enter to accept length' : 'Type a dimension in feet, inches, millimeters, or meters'; updateHudFromKeyboard(); }
  if (event.key === 'Escape' && mode === 'draw') {
    event.preventDefault();
    if (numericBuffer) numericBuffer = '';
    else if (draft.length) draft.pop();
    else mode = 'select';
    pointerWorld = draft.at(-1) ?? null;
    message = mode === 'draw' ? 'Last sketch step canceled' : 'Drawing canceled'; render();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.kind === 'vertex') handleAction('delete-vertex');
});

function updateHudFromKeyboard() {
  const hud = app.querySelector('.cursor-hud');
  if (!hud) return;
  const input = hud.querySelector('[data-hud-input]');
  input.textContent = numericBuffer || 'Type a length · Enter';
  input.classList.toggle('active', Boolean(numericBuffer));
}

render();
