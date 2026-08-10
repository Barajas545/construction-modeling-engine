import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../core/document/project-document.js';
import { nearestPointOnSegment, snapPoint } from '../core/geometry/vector.js';
import { formatFeetInches, formatSquareFeet } from '../core/units/length.js';
import { CommandStack, replaceDocument } from '../history/command-stack.js';
import { createDeckBoundary, insertVertex, removeVertex, setEdgeRole, updateVertex, validateDeckBoundary } from '../tools/deck-boundary/deck-boundary.js';

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
let selected = { kind: null, id: null };
let message = 'Ready';

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
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark">CME</div><div class="brand-copy"><div class="brand-name">Construction Modeling Engine</div><div class="brand-subtitle">Deck Boundary · Production workspace</div></div></div>
        <div class="project-name"><span class="saved-dot"></span>${escapeHtml(documentModel.name)} <span style="color:var(--muted);font-weight:500">· Saved locally</span></div>
        <div class="top-actions"><button class="button ghost" data-action="export">Export project</button><button class="button primary" data-action="finish" ${!current || !validation.valid ? 'disabled' : ''}>Boundary ready</button></div>
      </header>
      <section class="workspace-shell">
        <nav class="toolrail" aria-label="Modeling tools">
          <button class="tool-button ${mode === 'select' ? 'active' : ''}" data-mode="select" title="Select and edit"><span class="tool-icon">↖</span><span class="tool-label">Select</span></button>
          <button class="tool-button ${mode === 'draw' ? 'active' : ''}" data-mode="draw" title="Draw a custom deck boundary"><span class="tool-icon">◇</span><span class="tool-label">Boundary</span></button>
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
          <svg class="model-canvas ${mode === 'draw' ? 'drawing' : ''}" viewBox="-30 -25 360 250" aria-label="Deck boundary modeling workspace"></svg>
          <div class="statusbar"><div class="status-pill">${escapeHtml(message)}</div><div class="status-pill"><strong>½″ grid</strong> · Imperial · ${mode === 'draw' ? 'Click corners · Enter to close · Esc to cancel' : 'Drag corners · Double-click an edge to add a corner'}</div></div>
        </section>
        <aside class="inspector open">${renderInspector(current, validation)}</aside>
      </section>
    </main>`;
  bindEvents();
  drawCanvas(app.querySelector('.model-canvas'), current, validation);
}

function renderInspector(current, validation) {
  if (!current) return `
    <section class="inspector-section empty-panel"><div class="eyebrow">First construction object</div><div class="empty-symbol">◇</div><h2>Define the deck surface</h2><p class="section-copy">Start from field dimensions or draw a custom outline. The finished boundary becomes part of the project model.</p></section>
    <section class="inspector-section"><div class="eyebrow">Fast start</div><h2>Rectangle deck</h2><p class="section-copy">Enter the outside dimensions of the walkable surface.</p><div class="field-grid"><div class="field"><label for="width">Width (ft)</label><input id="width" type="number" min="1" step="0.5" value="16"></div><div class="field"><label for="depth">Depth (ft)</label><input id="depth" type="number" min="1" step="0.5" value="12"></div></div><div class="action-stack"><button class="button primary" data-action="create-rectangle">Create deck boundary</button><button class="button" data-mode="draw">Draw a custom outline</button></div><div class="hint-card">Measure the outside edge of the finished walking surface. Structural framing will connect to this boundary in future tools.</div></section>`;
  const selectedEdge = selected.kind === 'edge' ? current.edges.find((edge) => edge.id === selected.id) : null;
  const selectedVertex = selected.kind === 'vertex' ? current.vertices.find((vertex) => vertex.id === selected.id) : null;
  const firstIssue = validation.issues[0];
  return `
    <section class="inspector-section"><div class="eyebrow">Deck Boundary</div><h2>${escapeHtml(current.name)}</h2><p class="section-copy">The authoritative walkable surface for this project.</p><div class="metric-grid"><div class="metric"><div class="metric-label">Surface area</div><div class="metric-value">${formatSquareFeet(current.computed.areaSquareInches)}</div></div><div class="metric"><div class="metric-label">Perimeter</div><div class="metric-value">${formatFeetInches(current.computed.perimeterInches)}</div></div><div class="metric"><div class="metric-label">Corners</div><div class="metric-value">${current.vertices.length}</div></div><div class="metric"><div class="metric-label">House edges</div><div class="metric-value">${current.edges.filter((edge) => edge.role === 'house').length}</div></div></div><div class="validation ${validation.valid ? '' : 'error'}"><span class="validation-dot"></span><span>${validation.valid ? 'Boundary is closed and construction-ready.' : escapeHtml(firstIssue?.message ?? 'Boundary needs attention.')}</span></div></section>
    ${selectedEdge ? `<section class="inspector-section"><div class="eyebrow">Selected edge</div><h2>Construction relationship</h2><p class="section-copy">Mark how future objects should connect to this edge.</p><div class="field-grid"><div class="field full"><label for="edge-role">Edge role</label><select id="edge-role"><option value="open" ${selectedEdge.role === 'open' ? 'selected' : ''}>Unassigned</option><option value="house" ${selectedEdge.role === 'house' ? 'selected' : ''}>House attachment</option><option value="free-edge" ${selectedEdge.role === 'free-edge' ? 'selected' : ''}>Open deck edge</option></select></div></div><div class="hint-card">This relationship is stored on a stable edge ID so future railing, fascia, and house-attachment tools can reference it.</div></section>` : ''}
    ${selectedVertex ? `<section class="inspector-section"><div class="eyebrow">Selected corner</div><h2>Corner position</h2><p class="section-copy">Drag this corner in the workspace. Movement snaps to ½-inch increments and nearby axes.</p><div class="action-stack"><button class="button danger" data-action="delete-vertex" ${current.vertices.length <= 3 ? 'disabled' : ''}>Remove corner</button></div></section>` : ''}
    <section class="inspector-section"><div class="eyebrow">Project model</div><h2>Ready for future objects</h2><p class="section-copy">Edges and corners keep stable identities for house attachments, stairs, railings, fascia, framing, and takeoff.</p><div class="action-stack"><button class="button" data-action="new-boundary">Start over</button></div></section>`;
}

function drawCanvas(svg, current, validation) {
  const defs = svgElement('defs');
  const minor = svgElement('pattern', { id: 'minorGrid', width: '6', height: '6', patternUnits: 'userSpaceOnUse' });
  minor.append(svgElement('path', { d: 'M 6 0 L 0 0 0 6', class: 'grid-minor', fill: 'none' }));
  const major = svgElement('pattern', { id: 'majorGrid', width: '24', height: '24', patternUnits: 'userSpaceOnUse' });
  major.append(svgElement('rect', { width: '24', height: '24', fill: 'url(#minorGrid)' }), svgElement('path', { d: 'M 24 0 L 0 0 0 24', class: 'grid-major', fill: 'none' }));
  defs.append(minor, major);
  svg.append(defs, svgElement('rect', { x: '-30', y: '-25', width: '360', height: '250', fill: 'url(#majorGrid)' }));
  svg.append(svgElement('line', { x1: '-30', y1: '0', x2: '330', y2: '0', class: 'axis-line' }), svgElement('line', { x1: '0', y1: '-25', x2: '0', y2: '225', class: 'axis-line' }));
  if (current) renderBoundarySvg(svg, current, validation);
  if (draft.length) renderDraft(svg);
}

function renderBoundarySvg(svg, current, validation) {
  const points = current.vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
  svg.append(svgElement('polygon', { points, class: `boundary-fill ${validation.valid ? '' : 'invalid'}` }));
  current.edges.forEach((edge, index) => {
    const start = current.vertices[index];
    const end = current.vertices[(index + 1) % current.vertices.length];
    const selectedClass = selected.kind === 'edge' && selected.id === edge.id ? 'selected' : '';
    svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `boundary-edge-visible ${edge.role} ${selectedClass}` }));
    const hit = svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'boundary-edge', 'data-edge-id': edge.id });
    svg.append(hit);
    addDimension(svg, start, end);
  });
  current.vertices.forEach((vertex) => {
    svg.append(svgElement('circle', { cx: vertex.x, cy: vertex.y, r: '2.7', class: `vertex ${selected.kind === 'vertex' && selected.id === vertex.id ? 'selected' : ''}`, 'data-vertex-id': vertex.id }));
  });
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
  draft.forEach((vertex, index) => svg.append(svgElement('circle', { cx: vertex.x, cy: vertex.y, r: index === 0 ? 3.4 : 2.5, class: `vertex ${index === 0 ? 'start' : ''}`, 'data-draft-index': index })));
  if (pointerWorld && draft.length) {
    const anchor = draft[draft.length - 1];
    if (Math.abs(pointerWorld.x - anchor.x) < .01) svg.append(svgElement('line', { x1: pointerWorld.x, y1: '-25', x2: pointerWorld.x, y2: '225', class: 'guide-line' }));
    if (Math.abs(pointerWorld.y - anchor.y) < .01) svg.append(svgElement('line', { x1: '-30', y1: pointerWorld.y, x2: '330', y2: pointerWorld.y, class: 'guide-line' }));
  }
}

function bindEvents() {
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  app.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));
  const role = app.querySelector('#edge-role');
  if (role) role.addEventListener('change', () => commitBoundary(setEdgeRole(boundary(), selected.id, role.value), 'Set edge relationship'));
  const svg = app.querySelector('.model-canvas');
  svg.addEventListener('pointerdown', (event) => canvasPointerDown(svg, event));
  svg.addEventListener('pointermove', (event) => canvasPointerMove(svg, event));
  svg.addEventListener('pointerup', finishVertexDrag);
  svg.addEventListener('pointercancel', finishVertexDrag);
  svg.addEventListener('dblclick', (event) => edgeDoubleClick(svg, event));
}

function setMode(nextMode) {
  mode = nextMode;
  if (mode !== 'draw') { draft = []; pointerWorld = null; message = 'Ready'; }
  else message = 'Click the first corner of the deck';
  render();
}

function canvasPointerDown(svg, event) {
  const vertexId = event.target.dataset.vertexId;
  const edgeId = event.target.dataset.edgeId;
  if (mode === 'select' && vertexId) {
    selected = { kind: 'vertex', id: vertexId };
    draggingVertexId = vertexId;
    dragStartDocument = documentModel;
    svg.setPointerCapture(event.pointerId);
    drawCanvasRefresh();
    return;
  }
  if (mode === 'select' && edgeId) {
    selected = { kind: 'edge', id: edgeId };
    render();
    return;
  }
  if (mode !== 'draw') { selected = { kind: null, id: null }; render(); return; }
  const raw = screenToWorld(svg, event);
  const snapped = snapPoint(raw, draft[draft.length - 1], { grid: .5, axisThreshold: 2 });
  if (draft.length >= 3 && Math.hypot(snapped.point.x - draft[0].x, snapped.point.y - draft[0].y) < 5) { completeDraft(); return; }
  draft.push(snapped.point);
  message = draft.length < 3 ? 'Continue to the next corner' : 'Click the first corner or press Enter to close';
  render();
}

function canvasPointerMove(svg, event) {
  const raw = screenToWorld(svg, event);
  if (draggingVertexId && boundary()) {
    const current = boundary();
    const index = current.vertices.findIndex((vertex) => vertex.id === draggingVertexId);
    const anchor = current.vertices[(index - 1 + current.vertices.length) % current.vertices.length];
    const snapped = snapPoint(raw, anchor, { grid: .5, axisThreshold: 2 });
    documentModel = upsertObject(documentModel, updateVertex(current, draggingVertexId, snapped.point));
    persist();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'draw') {
    pointerWorld = snapPoint(raw, draft[draft.length - 1], { grid: .5, axisThreshold: 2 }).point;
    drawCanvasRefresh();
  }
}

function drawCanvasRefresh() {
  const svg = app.querySelector('.model-canvas');
  svg.innerHTML = '';
  const current = boundary();
  drawCanvas(svg, current, current ? validateDeckBoundary(current) : null);
}

function finishVertexDrag() {
  if (draggingVertexId && dragStartDocument && dragStartDocument !== documentModel) {
    const finalDocument = documentModel;
    documentModel = dragStartDocument;
    commit(finalDocument, 'Move boundary corner');
  }
  draggingVertexId = null;
  dragStartDocument = null;
}

function edgeDoubleClick(svg, event) {
  if (mode !== 'select' || !event.target.dataset.edgeId) return;
  const current = boundary();
  const edgeId = event.target.dataset.edgeId;
  const edgeIndex = current.edges.findIndex((edge) => edge.id === edgeId);
  const raw = screenToWorld(svg, event);
  const projected = nearestPointOnSegment(raw, current.vertices[edgeIndex], current.vertices[(edgeIndex + 1) % current.vertices.length]);
  commitBoundary(insertVertex(current, edgeId, projected.point), 'Add boundary corner');
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
  if (action === 'undo') { documentModel = history.undo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Undid last change'; render(); }
  if (action === 'redo') { documentModel = history.redo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Redid change'; render(); }
  if (action === 'delete-vertex' && selected.kind === 'vertex') { commitBoundary(removeVertex(boundary(), selected.id), 'Remove boundary corner'); selected = { kind: null, id: null }; message = 'Corner removed'; }
  if (action === 'new-boundary') {
    const next = { ...documentModel, objects: documentModel.objects.filter((object) => object.type !== 'deck-boundary') };
    commit(next, 'Remove deck boundary'); selected = { kind: null, id: null }; mode = 'select'; message = 'Ready for a new boundary';
  }
  if (action === 'export') exportProject();
  if (action === 'finish') { message = 'Boundary is construction-ready'; render(); }
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

window.addEventListener('keydown', (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); handleAction(event.shiftKey ? 'redo' : 'undo'); }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); handleAction('redo'); }
  if (event.key === 'Enter' && mode === 'draw') completeDraft();
  if (event.key === 'Escape' && mode === 'draw') { draft = []; pointerWorld = null; mode = 'select'; message = 'Drawing canceled'; render(); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.kind === 'vertex') handleAction('delete-vertex');
});

render();
