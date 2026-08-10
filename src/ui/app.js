import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../core/document/project-document.js';
import { collectSnapTargets, resolveSnap } from '../core/geometry/snap-engine.js';
import { nearestPointOnSegment } from '../core/geometry/vector.js';
import { formatFeetInches, formatSquareFeet } from '../core/units/length.js';
import { parseConstructionLength } from '../core/units/parse-length.js';
import { CommandStack, replaceDocument } from '../history/command-stack.js';
import { adaptiveGridSpacing, createViewport, fitViewport, panViewport, zoomViewport } from '../rendering/viewport-controller.js';
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
let viewport = createViewport();
let panGesture = null;
let lastMiddleClick = 0;
let snapState = { type: 'grid', label: 'Grid', guides: [] };
let numericBuffer = '';
let lastLength = null;
let gridSetting = 'auto';
let gridVisible = true;
let viewportAnimation = 0;

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
          <svg class="model-canvas ${mode === 'draw' ? 'drawing' : ''}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" aria-label="Deck boundary modeling workspace"></svg>
          <div class="cursor-hud" aria-live="polite"><div class="hud-row"><span>Length</span><strong data-hud-length>—</strong></div><div class="hud-row"><span>Angle</span><strong data-hud-angle>—</strong></div><div class="hud-row snap"><span data-hud-snap-dot></span><strong data-hud-snap>Grid</strong></div><div class="hud-input" data-hud-input>Type a length</div></div>
          <div class="statusbar"><div class="status-pill">${escapeHtml(message)}</div><div class="status-pill"><strong>${gridSetting === 'auto' ? 'Adaptive' : `${gridSetting}″`} grid</strong> · Wheel zoom · Right-drag pan · Middle double-click fit</div></div>
        </section>
        <aside class="inspector open">${renderInspector(current, validation)}${renderGridControls()}</aside>
      </section>
    </main>`;
  bindEvents();
  drawCanvas(app.querySelector('.model-canvas'), current, validation);
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
  const firstIssue = validation.issues[0];
  return `
    <section class="inspector-section"><div class="eyebrow">Deck Boundary</div><h2>${escapeHtml(current.name)}</h2><p class="section-copy">The authoritative walkable surface for this project.</p><div class="metric-grid"><div class="metric"><div class="metric-label">Surface area</div><div class="metric-value">${formatSquareFeet(current.computed.areaSquareInches)}</div></div><div class="metric"><div class="metric-label">Perimeter</div><div class="metric-value">${formatFeetInches(current.computed.perimeterInches)}</div></div><div class="metric"><div class="metric-label">Corners</div><div class="metric-value">${current.vertices.length}</div></div><div class="metric"><div class="metric-label">House edges</div><div class="metric-value">${current.edges.filter((edge) => edge.role === 'house').length}</div></div></div><div class="validation ${validation.valid ? '' : 'error'}"><span class="validation-dot"></span><span>${validation.valid ? 'Boundary is closed and construction-ready.' : escapeHtml(firstIssue?.message ?? 'Boundary needs attention.')}</span></div></section>
    ${selectedEdge ? `<section class="inspector-section"><div class="eyebrow">Selected edge</div><h2>Construction relationship</h2><p class="section-copy">Mark how future objects should connect to this edge.</p><div class="field-grid"><div class="field full"><label for="edge-role">Edge role</label><select id="edge-role"><option value="open" ${selectedEdge.role === 'open' ? 'selected' : ''}>Unassigned</option><option value="house" ${selectedEdge.role === 'house' ? 'selected' : ''}>House attachment</option><option value="free-edge" ${selectedEdge.role === 'free-edge' ? 'selected' : ''}>Open deck edge</option></select></div></div><div class="hint-card">This relationship is stored on a stable edge ID so future railing, fascia, and house-attachment tools can reference it.</div></section>` : ''}
    ${selectedVertex ? `<section class="inspector-section"><div class="eyebrow">Selected corner</div><h2>Corner position</h2><p class="section-copy">Drag this corner in the workspace. Movement snaps to ½-inch increments and nearby axes.</p><div class="action-stack"><button class="button danger" data-action="delete-vertex" ${current.vertices.length <= 3 ? 'disabled' : ''}>Remove corner</button></div></section>` : ''}
    <section class="inspector-section"><div class="eyebrow">Project model</div><h2>Ready for future objects</h2><p class="section-copy">Edges and corners keep stable identities for house attachments, stairs, railings, fascia, framing, and takeoff.</p><div class="action-stack"><button class="button" data-action="new-boundary">Start over</button></div></section>`;
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
  const markerSize = Math.max(2.8, viewport.width / 150);
  current.vertices.forEach((vertex) => {
    svg.append(svgElement('rect', { x: vertex.x - markerSize / 2, y: vertex.y - markerSize / 2, width: markerSize, height: markerSize, rx: markerSize * .12, class: `vertex ${selected.kind === 'vertex' && selected.id === vertex.id ? 'selected' : ''}`, transform: `rotate(45 ${vertex.x} ${vertex.y})`, 'data-vertex-id': vertex.id }));
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
  if (role) role.addEventListener('change', () => commitBoundary(setEdgeRole(boundary(), selected.id, role.value), 'Set edge relationship'));
  const gridSpacing = app.querySelector('#grid-spacing');
  if (gridSpacing) gridSpacing.addEventListener('change', () => { gridSetting = gridSpacing.value; render(); });
  const gridVisibility = app.querySelector('#grid-visible');
  if (gridVisibility) gridVisibility.addEventListener('change', () => { gridVisible = gridVisibility.checked; render(); });
  const svg = app.querySelector('.model-canvas');
  svg.addEventListener('pointerdown', (event) => canvasPointerDown(svg, event));
  svg.addEventListener('pointermove', (event) => canvasPointerMove(svg, event));
  svg.addEventListener('pointerup', finishPointerGesture);
  svg.addEventListener('pointercancel', finishPointerGesture);
  svg.addEventListener('wheel', (event) => zoomAtPointer(svg, event), { passive: false });
  svg.addEventListener('contextmenu', (event) => event.preventDefault());
  svg.addEventListener('dblclick', (event) => edgeDoubleClick(svg, event));
}

function setMode(nextMode) {
  mode = nextMode;
  numericBuffer = '';
  if (mode !== 'draw') { draft = []; pointerWorld = null; message = 'Ready'; }
  else message = 'Click the first corner of the deck';
  render();
}

function canvasPointerDown(svg, event) {
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
  const snapped = snapForPointer(raw, draft[draft.length - 1]);
  if (draft.length >= 3 && Math.hypot(snapped.point.x - draft[0].x, snapped.point.y - draft[0].y) < 5) { completeDraft(); return; }
  draft.push(snapped.point);
  numericBuffer = '';
  message = draft.length < 3 ? 'Continue to the next corner' : 'Click the first corner or press Enter to close';
  render();
}

function canvasPointerMove(svg, event) {
  if (panGesture?.pointerId === event.pointerId) {
    const dx = -(event.clientX - panGesture.startX) * panGesture.viewport.width / svg.clientWidth;
    const dy = -(event.clientY - panGesture.startY) * panGesture.viewport.height / svg.clientHeight;
    viewport = panViewport(panGesture.viewport, { x: dx, y: dy });
    drawCanvasRefresh();
    return;
  }
  const raw = screenToWorld(svg, event);
  if (draggingVertexId && boundary()) {
    const current = boundary();
    const index = current.vertices.findIndex((vertex) => vertex.id === draggingVertexId);
    const anchor = current.vertices[(index - 1 + current.vertices.length) % current.vertices.length];
    const adjacentIds = new Set([draggingVertexId, current.edges[index]?.id, current.edges[(index - 1 + current.edges.length) % current.edges.length]?.id]);
    const snapped = snapForPointer(raw, anchor, [], adjacentIds);
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

function finishPointerGesture() {
  if (panGesture) {
    panGesture = null;
    app.querySelector('.model-canvas')?.classList.remove('panning');
  }
  if (draggingVertexId && dragStartDocument && dragStartDocument !== documentModel) {
    const finalDocument = documentModel;
    documentModel = dragStartDocument;
    commit(finalDocument, 'Move boundary corner');
  }
  draggingVertexId = null;
  dragStartDocument = null;
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
  if (action === 'undo') { documentModel = history.undo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Undid last change'; render(); }
  if (action === 'redo') { documentModel = history.redo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Redid change'; render(); }
  if (action === 'delete-vertex' && selected.kind === 'vertex') { commitBoundary(removeVertex(boundary(), selected.id), 'Remove boundary corner'); selected = { kind: null, id: null }; message = 'Corner removed'; }
  if (action === 'new-boundary') {
    const next = { ...documentModel, objects: documentModel.objects.filter((object) => object.type !== 'deck-boundary') };
    commit(next, 'Remove deck boundary'); selected = { kind: null, id: null }; mode = 'select'; message = 'Ready for a new boundary';
  }
  if (action === 'export') exportProject();
  if (action === 'finish') { message = 'Boundary is construction-ready'; render(); }
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
