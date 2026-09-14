import { createProjectDocument, parseProject, serializeProject, setProjectWorkflowStage, upsertObject } from '../core/document/project-document.js';
import { activateLibraryProject, createProjectLibrary, getActiveProject, parseProjectLibrary, removeLibraryProject, serializeProjectLibrary, upsertLibraryProject } from '../core/document/project-library.js';
import { createSalesHubStepOneMessage, createSalesHubStepOnePayload, parseSalesHubLaunchContext } from '../core/integrations/dcr-sales-hub.js';
import { deriveModelProgress } from '../core/construction-objects/progressive-model.js';
import { getBoundaryLevelDown, getDeckBoundaries, getProjectSurfaceArea, setBoundaryLevelDown, translateDeckAssembly } from '../core/construction-objects/multi-deck-project.js';
import { normalizeBoundaryEdge } from '../core/construction-objects/edge-properties.js';
import { getDimensionLayer, getDimensionLeaderOffset, getDimensionOffset, isDimensionReferenceVisible, setDimensionLayerVisibility, setDimensionLeaderOffset, setDimensionOffset, setDimensionReferenceVisibility } from '../core/annotations/dimension-layer.js';
import { getCatConstructionLayer, setCatConstructionLayerVisibility } from '../core/annotations/cat-construction-layer.js';
import { getCatDimensionLayer, setCatDimensionLayerVisibility } from '../core/annotations/cat-dimension-layer.js';
import { getDeckingLayer, setDeckingLayerVisibility } from '../core/annotations/decking-layer.js';
import { getGridLayer, setGridLayerVisibility } from '../core/annotations/grid-layer.js';
import { getRailingLayer, setRailingLayerVisibility } from '../core/annotations/railing-layer.js';
import { getFramingLayer, setFramingLayerVisibility, setJoistLayerVisibility } from '../core/annotations/framing-layer.js';
import { normalizeJoistNominalSize } from '../core/standards/california-deck-joist-span.js';
import { collectSnapTargets, resolveSnap } from '../core/geometry/snap-engine.js';
import { getSnapSettings, setSnapSettings } from '../core/geometry/snap-settings.js';
import { nearestPointOnSegment } from '../core/geometry/vector.js';
import { formatFeetInches, formatInches, formatSquareFeet } from '../core/units/length.js';
import { parseConstructionLength } from '../core/units/parse-length.js';
import { CommandStack, replaceDocument } from '../history/command-stack.js';
import { adaptiveGridSpacing, createViewport, fitViewport, panViewport, zoomViewport } from '../rendering/viewport-controller.js';
import { chamferVertex, clearEdgeOrientationConstraint, createDeckBoundary, findAdjacentMergeCandidate, getBoundaryCentroid, getBoundaryLifecycle, getEdgeOrientationConstraint, insertVertex, isEdgeLocked, isVertexLocked, markBoundaryEdited, mergeAdjacentVertices, moveVertexWithConstraints, offsetEdge, orthogonalizeBoundary, removeVertex, setEdgeLength, setEdgeLocked, setEdgeOrientationConstraint, setEdgeRole, setVertexLocked, splitEdgeIntoSegments, updateEdgeProperties, validateDeckBoundary } from '../tools/deck-boundary/deck-boundary.js';
import { createBoundaryDraftSnapContext } from '../tools/deck-boundary/boundary-draft-snap.js';
import { deleteDeckAssembly } from '../tools/deck-boundary/delete-deck-assembly.js';
import { clearDeckBoardingDirection, deriveDeckBoardingSegments, getDeckBoarding, rotateDeckBoardingDirection, setDeckBoardingCurve, setDeckBoardingDirection } from '../tools/deck-boarding/deck-boarding.js';
import { isCatBoundaryVisible, isCatLineVisible, isDeckBoundaryVisible, setCatBoundaryVisibility, setDeckBoundaryVisibility, showAllBoundaries } from '../tools/boundary-visibility/boundary-visibility.js';
import { CAT_LINE_TYPE, CAT_MEASUREMENT_TYPE, CAT_NOTE_TYPE, applyCatOffset, createCatLine, createCatMeasurement, createCatNote, deriveCatBoundaries, deriveCatLineGeometry, deriveCatMeasurement, deriveCatOffset, dragCatLineArc, extendCatLineToLine, getCatLines, getCatMeasurements, getCatNotes, getCatSnapObjects, offsetCatLine, resolveCatLineEndpoint, setCatLineSagitta, trimCatLine, updateCatNote } from '../tools/cat-cl/cat-cl.js';
import { convertCatBoundaryToDeckBoundary } from '../tools/cat-cl/cat-boundary.js';
import { createLevelDown, deriveLevelDownDepth, deriveLevelDownRegion, orthogonalizeLevelDown, setLevelDownRiserHeight, splitLevelDownSegment, updateLevelDownProperties } from '../tools/level-down/level-down.js';
import { attachStairToBoundary, deriveStairDragOptions, deriveStairOpeningSnap, deriveStairSideSegments, deriveStairTreads, detachStairFromBoundary, findStairBoundaryConnection, getStairInterfaceEdge, getStairVertexMap, getStairVertices, materializeStairSideJunction, mergeStairBoundaryConnection, removeStairSideJunction, resolveStairHostEdge, setStairSidePosition, setStairWidth, synchronizeConnectedStairLevels, synchronizeHostedStairs, updateStairDimensions, updateStairInterfaceEdgeProperties, validateStairPlacement } from '../tools/stairs/stair.js';
import { deriveStairFraming } from '../tools/stair-framing/stair-framing.js';
import { deriveStairFramingGeometry } from '../tools/stair-framing/stair-framing-geometry.js';
import { getBoundaryArc } from '../core/geometry/circular-arc.js';
import { archLineBlockReason, dragArchLine, straightenArchLine } from '../tools/arch-line/arch-line.js';
import { deriveStairBoardingSeams } from '../tools/stairs/stair-boarding.js';
import { setStairCoveringStyle } from '../tools/stairs/stair-covering.js';
import { renderStairCoveringControls } from '../tools/stairs/stair-covering-controls.js';
import { analyzeRailingGeometries, createRailingLine, deriveRailingGeometry, deriveRailingLineGeometry, deriveRailingPostLayout, resolveRailingEndpointSnap, setRailingCornerDouble, updateRailingSettings } from '../tools/railing/railing.js';
import { TAKEOFF_CATEGORIES, addManualTakeoffLine, consolidateTakeoffLines, createTakeoffExport, getEffectiveTakeoffLines, removeManualTakeoffLine, resetTakeoffLine, updateTakeoffLine } from '../tools/takeoff/takeoff.js';
import { BEAM_SIZE_PRESETS, addBeam, beamMaterialLabel, createBeam, getBeams, normalizeBeamMaterial, planBeamStock, updateBeam } from '../tools/beam/beam.js';
import { deriveBeamGeometry, deriveBeamLoad, framingSystem } from '../tools/beam/beam-geometry.js';
import { DEFAULT_COPIES, DEFAULT_SPACING_INCHES, MAX_COPIES, addJoist, addParallelJoistToField, analyzeJoist, arrayObject, clipLinearMemberToPolygon, consolidateJoistRuns, createJoist, deriveJoistField, deriveSharedRimFlushSupports, getJoists, moveJoistField, planJoistStock, removeJoistField, updateJoist, updateJoistField } from '../tools/joist-group/joist-group.js';
import { addManualBlockingRow, deriveJoistBlockingRows, moveManualBlockingRow, removeManualBlockingRow, restoreAutomaticBlockingRows, setJoistBlockingMaterial, suppressAutomaticBlockingRow } from '../tools/joist-blocking/joist-blocking.js';
import { CONCRETE_BAGS_PER_POST, DEFAULT_MANUAL_FOOTING_SIZE_INCHES, addPost, createPost, getPillars, getPosts } from '../tools/post-footing/post-footing.js';
import { RIM_JOIST_SIZE_PRESETS, createRimJoistProperty, normalizeRimJoist, rimJoistLabel } from '../tools/rim-joist/rim-joist.js';
import { dominantBoundaryJoistSize } from '../tools/ledger/ledger.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'cme.project.v1';
const PROJECT_LIBRARY_STORAGE_KEY = 'cme.project-library.v1';
const app = document.querySelector('#app');
let history = new CommandStack();
let projectLibrary = loadProjectLibrary();
projectLibrary = { ...projectLibrary, projects: projectLibrary.projects.map((project) => synchronizeHostedStairs(consolidateJoistRuns(project))) };
let documentModel = getActiveProject(projectLibrary);
localStorage.setItem(PROJECT_LIBRARY_STORAGE_KEY, serializeProjectLibrary(projectLibrary));
localStorage.setItem(STORAGE_KEY, serializeProject(documentModel));
const salesHubLaunch = parseSalesHubLaunchContext(window.location.search);
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
let viewportAnimation = 0;
const activeTouches = new Map();
let touchGesture = null;
let pendingTouch = null;
let stairDraft = null;
let stairGesture = null;
let stairSideGesture = null;
let dimensionDragStart = null;
let dimensionLeaderMode = null;
let dimensionLeaderGesture = null;
let chamferMode = null;
let chamferGesture = null;
let chamferDraft = null;
let archMode = null;
let archGesture = null;
let archDraft = null;
let railingDraft = null;
let railingGesture = null;
let levelDownDraft = [];
let levelDownPointer = null;
let activeBoundaryId = null;
let moveBoundaryMode = null;
let moveBoundaryGesture = null;
let boardingDirectionMode = null;
let pendingDeckDeleteId = null;
let utilityPanel = null;
let projectMenuOpen = false;
let exportMenuOpen = false;
let pendingProjectDeleteId = null;
let catTool = 'line';
let catDraft = null;
let catPointer = null;
let catSnapState = { type: 'none', label: 'Free', guides: [] };
let catNoteDragStart = null;
let catArchMode = null;
let catArchGesture = null;
let catArchDraft = null;
let lastCatOffsetDistance = null;
let catAudioRecorder = null;
let catAudioChunks = [];
let takeoffOpen = false;
let takeoffExpanded = new Set(['decking', 'railing']);
let takeoffAddCategory = null;
let takeoffViewMode = 'detailed';
let framingTool = 'joist';
let framingDraft = null;
let framingGesture = null;
let joistTargetBoundaryId = null;
let framingNodeGesture = null;
let joistMeshMoveMode = null;
let joistMeshMoveGesture = null;
let singleJoistMode = null;
let blockingAddMode = null;
let blockingMoveMode = null;
let blockingMoveGesture = null;
let framingSpacing = DEFAULT_SPACING_INCHES;
let framingCopies = DEFAULT_COPIES;

function loadProjectLibrary() {
  const savedLibrary = localStorage.getItem(PROJECT_LIBRARY_STORAGE_KEY);
  if (savedLibrary) {
    try {
      const library = parseProjectLibrary(savedLibrary);
      if (getActiveProject(library)) return library;
    } catch { /* Migrate the last single-project save below. */ }
  }
  const savedProject = localStorage.getItem(STORAGE_KEY);
  if (savedProject) {
    try { return createProjectLibrary(parseProject(savedProject)); } catch { /* Recover with a new project below. */ }
  }
  return createProjectLibrary(createProjectDocument({ name: 'Backyard deck' }));
}

function boundaries() {
  return getDeckBoundaries(documentModel);
}

function boundary() {
  const decks = boundaries();
  const current = decks.find((entry) => entry.id === activeBoundaryId) ?? decks[0] ?? null;
  if (current) activeBoundaryId = current.id;
  return current;
}

function boundaryById(boundaryId) {
  return boundaries().find((entry) => entry.id === boundaryId) ?? null;
}

function boundaryForReference(referenceId) {
  if (!referenceId) return null;
  const direct = boundaries().find((entry) => entry.id === referenceId || `${entry.id}:area` === referenceId || entry.vertices.some((vertex) => vertex.id === referenceId) || entry.edges.some((edge) => edge.id === referenceId));
  if (direct) return direct;
  const stair = documentModel.objects.find((object) => object.type === 'stair' && (object.id === referenceId || getStairInterfaceEdge(object).id === referenceId));
  if (stair) return boundaryById(stair.host.boundaryId);
  const levelDown = documentModel.objects.find((object) => object.type === 'level-down' && (object.id === referenceId || `${object.id}:drop` === referenceId || object.segments?.some((segment) => segment.id === referenceId)));
  if (levelDown) return boundaryById(levelDown.host.boundaryId);
  const railing = documentModel.objects.find((object) => object.type === 'railing-run' && object.id === referenceId);
  const railingBoundaryId = railing?.host?.boundaryId ?? railing?.anchors?.start?.boundaryId ?? railing?.anchors?.end?.boundaryId;
  return boundaryById(railingBoundaryId);
}

function activateBoundary(boundaryId) {
  if (boundaryId && boundaryById(boundaryId)) activeBoundaryId = boundaryId;
}

function commit(next, label) {
  documentModel = history.execute(documentModel, replaceDocument(synchronizeHostedStairs(next), label));
  persist();
  render();
}

function commitBoundary(nextBoundary, label) {
  activeBoundaryId = nextBoundary.id;
  commit(upsertObject(documentModel, nextBoundary), label);
}

function commitArchBoundary(nextBoundary) {
  let next = upsertObject(documentModel, markBoundaryEdited(nextBoundary));
  const fields = new Set(getJoists(next).filter((joist) => joist.layout?.boundaryId === nextBoundary.id).map((joist) => joist.layout?.fieldId).filter(Boolean));
  for (const fieldId of fields) {
    const result = updateJoistField(next, fieldId, { boundary: nextBoundary, supports: joistSupportsForBoundary(nextBoundary) });
    if (!result.changed) throw new Error('This curve would invalidate a Joist Field. Adjust the framing before applying the arc.');
    next = result.document;
  }
  commit(next, 'Reshape boundary Arch line');
}

function renderArchDimensions(svg, deck, arc) {
  const line = (a, b, className) => svg.append(svgElement('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: className }));
  line(arc.start, arc.end, 'arch-guide');
  const label = (a, b, text, side) => {
    line(a, b, 'arch-guide');
    const x = (a.x + b.x) / 2 + side * 9;
    const y = (a.y + b.y) / 2 - 4;
    const width = Math.max(22, text.length * 3.2);
    svg.append(svgElement('rect', { x: x - width / 2, y: y - 5, width, height: 10, rx: 2, class: 'dimension-bg arch-label' }));
    const node = svgElement('text', { x, y, class: 'dimension-text arch-label' });
    node.textContent = text; svg.append(node);
  };
  label(arc.center, arc.start, `R ${formatFeetInches(arc.radius, .0625)}`, -1);
  label(arc.midpoint, arc.apex, `H ${formatInches(Math.abs(arc.sagitta))}`, 1);
  for (const [role, point] of [['chord-midpoint', arc.midpoint], ['arc-midpoint', arc.apex]]) {
    svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: Math.max(1.5, viewport.width / 420), class: 'arch-node', 'data-edge-id': arc.id, 'data-boundary-id': deck.id, 'data-arch-node': role }));
  }
}

function renderCatArchDimensions(svg, line, geometry) {
  if (geometry.kind !== 'arc' || !getCatDimensionLayer(documentModel).visible) return;
  const drawLine = (a, b) => svg.append(svgElement('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'cat-arch-guide' }));
  const label = (a, b, text, side) => {
    drawLine(a, b);
    const x = (a.x + b.x) / 2 + side * 9;
    const y = (a.y + b.y) / 2 - 4;
    const width = Math.max(22, text.length * 3.2);
    svg.append(svgElement('rect', { x: x - width / 2, y: y - 5, width, height: 10, rx: 2, class: 'cat-arch-label-bg', 'data-cat-object-id': line.id }));
    const node = svgElement('text', { x, y, class: 'cat-arch-label-text' });
    node.textContent = text;
    svg.append(node);
  };
  label(geometry.center, line.vertices[0], `R ${formatFeetInches(geometry.radius, .0625)}`, -1);
  label(geometry.midpoint, geometry.apex, `H ${formatInches(Math.abs(geometry.sagitta))}`, 1);
  for (const point of [geometry.midpoint, geometry.apex]) svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: Math.max(1.5, viewport.width / 420), class: 'cat-arch-node', 'data-cat-object-id': line.id }));
}

function persist() {
  projectLibrary = upsertLibraryProject(projectLibrary, documentModel);
  localStorage.setItem(PROJECT_LIBRARY_STORAGE_KEY, serializeProjectLibrary(projectLibrary));
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
  const dimensionLayer = getDimensionLayer(documentModel);
  const railingLayer = getRailingLayer(documentModel);
  const catConstructionLayer = getCatConstructionLayer(documentModel);
  const framingLayer = getFramingLayer(documentModel);
  const projectSurface = getProjectSurfaceArea(documentModel);
  const deckAreaCount = boundaries().length;
  const railingSummary = analyzeRailingGeometries(getAllRailingGeometries(), documentModel.railingCornerSettings);
  const stairCount = documentModel.objects.filter((object) => object.type === 'stair').length;
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark">CME</div><div class="brand-copy"><div class="brand-name">Construction Modeling Engine</div><div class="brand-subtitle">${progress.stage.label} · One evolving project</div></div></div>
        <div class="project-switcher"><button class="project-switcher-button ${projectMenuOpen ? 'active' : ''}" data-action="toggle-project-menu" aria-expanded="${projectMenuOpen}"><span class="saved-dot"></span><span>${escapeHtml(documentModel.name)}</span><small>Saved locally</small><b>⌄</b></button>${renderProjectMenu()}</div>
        <div class="project-summary" aria-label="Project totals"><div class="top-metric"><span>Project surface</span><strong>${formatSquareFeet(projectSurface)}</strong></div><div class="top-metric"><span>Deck areas</span><strong>${deckAreaCount}</strong></div></div>
        <div class="top-actions"><button class="button primary save-step-one" data-action="save-step-one">Save to Step 1</button><div class="export-control"><button class="button ghost export-toggle ${exportMenuOpen ? 'active-constraint' : ''}" data-action="toggle-export-menu" aria-expanded="${exportMenuOpen}"><span class="export-long">Export options</span><span class="export-short">Export</span> ⌄</button>${renderExportMenu()}</div></div>
      </header>
      ${renderTakeoffWorkspace()}
      <section class="workspace-shell">
        <nav class="toolrail" aria-label="Modeling tools">
          <button class="tool-button ${mode === 'select' ? 'active' : ''}" data-mode="select" title="Select and edit"><span class="tool-icon">↖</span><span class="tool-label">Select</span></button>
          <button class="tool-button ${mode === 'draw' ? 'active' : ''}" data-mode="draw" title="Draw a custom deck boundary"><span class="tool-icon">◇</span><span class="tool-label">Boundary</span></button>
          <button class="tool-button ${mode === 'stair' ? 'active' : ''}" data-mode="stair" title="Attach stairs to a boundary edge" ${!current ? 'disabled' : ''}><span class="tool-icon">▰</span><span class="tool-label">Stairs</span></button>
          <button class="tool-button ${mode === 'railing' ? 'active' : ''}" data-mode="railing" title="Add railing along a construction edge" ${!current ? 'disabled' : ''}><span class="tool-icon">╥</span><span class="tool-label">Railing</span></button>
          <button class="tool-button ${mode === 'cat' ? 'active' : ''}" data-mode="cat" title="Create CAT construction references and field measurements"><span class="tool-icon">⌁</span><span class="tool-label">CAT CL</span></button>
          <button class="tool-button ${mode === 'framing' ? 'active' : ''}" data-mode="framing" title="Place joist fields, beams, and post / footing assemblies"><span class="tool-icon">▤</span><span class="tool-label">Framing</span></button>
          <div class="tool-spacer"></div>
          <button class="tool-button ${utilityPanel === 'visibility' ? 'active' : ''}" data-action="toggle-visibility-panel" title="Drawing layer visibility" aria-pressed="${utilityPanel === 'visibility'}"><span class="tool-icon">◉</span><span class="tool-label">Visibility</span></button>
          <button class="tool-button ${utilityPanel === 'snap' ? 'active' : ''}" data-action="toggle-snap-panel" title="Snap and precision controls" aria-pressed="${utilityPanel === 'snap'}"><span class="tool-icon">⌁</span><span class="tool-label">Snap</span></button>
          <button class="tool-button" data-action="toggle-inspector" title="Project details"><span class="tool-icon">☷</span><span class="tool-label">Details</span></button>
        </nav>
        <section class="canvas-panel">
          <div class="canvas-toolbar">
            <button class="button icon-button ghost" data-action="undo" aria-label="Undo" ${!history.canUndo ? 'disabled' : ''}>↶</button>
            <button class="button icon-button ghost" data-action="redo" aria-label="Redo" ${!history.canRedo ? 'disabled' : ''}>↷</button>
            <span class="divider"></span>
            <button class="button ${railingLayer.visible ? 'active-constraint' : 'ghost'}" data-action="toggle-railing-visibility" aria-pressed="${railingLayer.visible}" title="Show or hide all railing construction objects">${railingLayer.visible ? '◉' : '○'} Railing</button>
            <button class="button ${catConstructionLayer.visible ? 'active-constraint' : 'ghost'}" data-action="toggle-cat-construction-lines" aria-pressed="${catConstructionLayer.visible}" title="Show or hide future CAT construction lines">${catConstructionLayer.visible ? '◉' : '○'} CAT construction lines</button>
            <button class="button ${framingLayer.visible ? 'active-constraint' : 'ghost'}" data-action="toggle-framing-visibility" aria-pressed="${framingLayer.visible}" title="Show or hide framing construction objects">${framingLayer.visible ? '◉' : '○'} Framing</button>
            <button class="button ${dimensionLayer.visible ? 'active-constraint' : 'ghost'}" data-action="toggle-dimensions" title="Show or hide the Dimensions layer">${dimensionLayer.visible ? '◉' : '○'} Dimensions</button>
            ${draft.length >= 3 ? '<button class="button primary" data-action="complete-draft">Close boundary</button>' : ''}
            ${mode === 'level-down' ? '<button class="button primary" data-action="cancel-level-down">Cancel Level Down</button>' : ''}
          </div>
          ${renderCatToolbar()}
          ${renderFramingToolbar()}
          <svg class="model-canvas ${['draw', 'level-down', 'cat', 'framing'].includes(mode) ? 'drawing' : ''} ${mode === 'cat' ? 'cat' : ''} ${boardingDirectionMode ? 'board-direction' : ''}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" aria-label="Deck boundary modeling workspace"></svg>
          <div class="cursor-hud" aria-live="polite"><div class="hud-row"><span data-hud-length-label>Length</span><strong data-hud-length>—</strong></div><div class="hud-row"><span data-hud-angle-label>Angle</span><strong data-hud-angle>—</strong></div><div class="hud-row snap"><span data-hud-snap-dot></span><strong data-hud-snap>Grid</strong></div><div class="hud-input" data-hud-input>Type a length</div></div>
          <div class="stair-live-hud" aria-live="polite"><div class="stair-live-label">TOTAL RISE</div><strong data-stair-live-rise>0″</strong><div class="stair-live-grid"><span><b data-stair-live-risers>—</b> risers</span><span><b data-stair-live-treads>—</b> treads</span><span><b data-stair-live-riser>—</b> each rise</span><span><b data-stair-live-tread>—</b> each tread</span><span class="stair-live-run"><b data-stair-live-run>—</b> total run</span></div><small data-stair-live-status>Release to build · 5″–7.5″ risers · 10″–11″ treads</small></div>
          ${renderCatOperationPrompt()}
          ${renderUtilityPopover()}
          <section class="print-title-block"><div><div class="eyebrow">CME Sketch Plan</div><h1>${escapeHtml(documentModel.name)}</h1></div><div class="print-metrics"><span><small>Decking</small><strong>${formatSquareFeet(projectSurface)}</strong></span><span><small>Railing</small><strong>${formatFeetInches(railingSummary.totalLength)}</strong></span><span><small>Stairs</small><strong>${stairCount}</strong></span></div></section>
          <div class="statusbar"><div class="status-pill">${escapeHtml(message)}</div><div class="status-pill"><strong>${gridSetting === 'auto' ? 'Adaptive' : `${gridSetting}″`} grid</strong> · Wheel zoom · Right-drag pan · Middle double-click fit</div></div>
        </section>
        <aside class="inspector open">${renderContextPanel(current)}${renderInspector(current, validation)}</aside>
      </section>
    </main>`;
  bindEvents();
  drawCanvas(app.querySelector('.model-canvas'), current, validation);
}

function renderProjectMenu() {
  if (!projectMenuOpen) return '';
  const projects = [...projectLibrary.projects].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const rows = projects.map((project) => {
    const active = project.id === documentModel.id;
    const confirming = pendingProjectDeleteId === project.id;
    const area = getProjectSurfaceArea(project);
    return `<article class="project-list-item ${active ? 'active' : ''}"><button class="project-open" data-action="open-project" data-project-id="${escapeHtml(project.id)}"><span><strong>${escapeHtml(project.name)}</strong><small>${formatSquareFeet(area)} · ${new Date(project.updatedAt).toLocaleDateString()}</small></span>${active ? '<b>OPEN</b>' : '<b>Open</b>'}</button>${confirming ? `<div class="project-delete-confirm"><span>Delete this local project?</span><button class="button danger" data-action="confirm-delete-project" data-project-id="${escapeHtml(project.id)}">Delete</button><button class="button ghost" data-action="cancel-delete-project">Cancel</button></div>` : `<button class="project-delete" data-action="request-delete-project" data-project-id="${escapeHtml(project.id)}" aria-label="Delete ${escapeHtml(project.name)}">×</button>`}</article>`;
  }).join('');
  return `<section class="project-menu" role="dialog" aria-label="Project options"><div class="project-menu-heading"><div><div class="eyebrow">Current project</div><strong>Project options</strong></div><button class="menu-close" data-action="close-project-menu" aria-label="Close project options">×</button></div><label class="project-name-editor"><span>Project name</span><div><input id="project-name-input" value="${escapeHtml(documentModel.name)}" maxlength="80"><button class="button" data-action="rename-project">Save</button></div></label><button class="button primary new-project-button" data-action="new-project">+ New project</button><div class="project-list-heading"><span>Projects on this device</span><small>${projects.length}</small></div><div class="project-list">${rows}</div><p class="project-storage-note">Projects autosave independently. Future SharePoint or OneDrive sync can replace this local library without changing the project format.</p></section>`;
}

function renderExportMenu() {
  if (!exportMenuOpen) return '';
  return `<section class="export-menu" role="menu"><button data-action="open-takeoff"><span><strong>Takeoff</strong><small>Editable materials, pricing, and supplier quote</small></span><b>NEW</b></button><button data-action="export-pdf"><span><strong>Export PDF</strong><small>Professional visual sketch and field quantities</small></span><b>PDF</b></button><button data-action="download-step-one-json"><span><strong>Download Step 1 JSON</strong><small>Portable fallback for DCR Sales Hub</small></span><b>JSON</b></button></section>`;
}

function takeoffContext() {
  const railingGeometries = getAllRailingGeometries();
  const railing = analyzeRailingGeometries(railingGeometries, documentModel.railingCornerSettings);
  return { railingGeometries, railingPostCount: railing.estimatedPostCount, railingCornerSettings: documentModel.railingCornerSettings };
}

function renderTakeoffLine(line) {
  const consolidated = line.origin === 'consolidated';
  const sourceLabel = consolidated ? 'PURCHASE' : line.origin === 'adjusted' ? 'ADJUSTED' : line.origin === 'manual' ? 'MANUAL' : 'AUTO';
  const price = line.unitPrice == null ? '' : line.unitPrice;
  const subtotal = line.unitPrice == null ? '—' : `$${(line.quantity * line.unitPrice).toFixed(2)}`;
  const calculation = line.calculatedQuantity == null ? '' : `<small>Calculated ${line.calculatedQuantity}${line.requiredLinearFeet ? ` · ${line.requiredLinearFeet} LF net` : ''}${line.confidence !== 'calculated' ? ' · REVIEW' : ''}</small>`;
  return `<div class="takeoff-line"><div class="takeoff-material"><span class="takeoff-origin ${line.origin}">${sourceLabel}</span><strong>${escapeHtml(line.description)}</strong><small>${escapeHtml(line.specification ?? '')}</small>${calculation}</div><label><span>Qty</span><input type="number" min="0" step="1" value="${line.quantity}" ${consolidated ? 'readonly' : `data-takeoff-quantity="${escapeHtml(line.id)}"`}></label><label class="takeoff-price"><span>Unit price</span><input type="number" min="0" step="0.01" placeholder="—" value="${price}" ${consolidated ? 'readonly' : `data-takeoff-price="${escapeHtml(line.id)}"`}></label><div class="takeoff-subtotal"><span>Subtotal</span><strong>${subtotal}</strong></div><div class="takeoff-line-actions">${line.origin === 'manual' ? `<button class="icon-button danger" data-action="delete-takeoff-line" data-line-id="${escapeHtml(line.id)}" aria-label="Delete material">×</button>` : line.origin === 'adjusted' ? `<button class="button ghost" data-action="reset-takeoff-line" data-line-id="${escapeHtml(line.id)}">Reset</button>` : ''}</div></div>`;
}

function renderTakeoffWorkspace() {
  if (!takeoffOpen) return '';
  const detailedLines = getEffectiveTakeoffLines(documentModel, takeoffContext());
  const lines = takeoffViewMode === 'consolidated' ? consolidateTakeoffLines(detailedLines) : detailedLines;
  const editableTakeoff = takeoffViewMode === 'detailed';
  const knownTotal = lines.reduce((sum, line) => sum + (line.unitPrice == null ? 0 : line.quantity * line.unitPrice), 0);
  const unpriced = lines.filter((line) => line.unitPrice == null).length;
  const categories = TAKEOFF_CATEGORIES.map((category) => {
    const categoryLines = lines.filter((line) => line.category === category.id);
    const expanded = takeoffExpanded.has(category.id);
    const adding = editableTakeoff && takeoffAddCategory === category.id;
    return `<section class="takeoff-category ${expanded ? 'expanded' : ''}"><button class="takeoff-category-heading" data-action="toggle-takeoff-category" data-category="${category.id}" aria-expanded="${expanded}"><span><b>${expanded ? '−' : '+'}</b><strong>${category.label}</strong></span><small>${categoryLines.length} material${categoryLines.length === 1 ? '' : 's'}</small></button>${expanded ? `<div class="takeoff-category-body">${categoryLines.length ? categoryLines.map(renderTakeoffLine).join('') : `<div class="takeoff-empty">${editableTakeoff ? 'No calculated materials yet. Add a project material or keep modeling.' : 'No purchasing material in this category.'}</div>`}${adding ? `<div class="takeoff-add-form"><label><span>Material</span><input id="takeoff-new-description" placeholder="Example: Pressure treated joist"></label><label><span>Specification</span><input id="takeoff-new-specification" placeholder="Example: 2×8×16"></label><label><span>Quantity</span><input id="takeoff-new-quantity" type="number" min=".01" step="1" value="1"></label><label><span>Unit</span><select id="takeoff-new-unit"><option value="ea">pieces</option><option value="lf">LF</option><option value="sf">SF</option><option value="box">boxes</option><option value="bag">bags</option><option value="gal">gallons</option></select></label><label><span>Unit price · optional</span><input id="takeoff-new-price" type="number" min="0" step=".01" placeholder="—"></label><div class="takeoff-add-actions"><button class="button primary" data-action="save-takeoff-line" data-category="${category.id}">Add material</button><button class="button ghost" data-action="cancel-takeoff-line">Cancel</button></div></div>` : editableTakeoff ? `<button class="button ghost takeoff-add" data-action="add-takeoff-line" data-category="${category.id}">+ Add material</button>` : ''}</div>` : ''}</section>`;
  }).join('');
  const modeHelp = takeoffViewMode === 'consolidated' ? 'Purchasing view groups identical material, dimensions, and stock lengths across construction roles.' : 'Construction view preserves why and where every material is used; quantities remain editable.';
  return `<section class="takeoff-overlay" role="dialog" aria-modal="true" aria-label="Project material takeoff"><header class="takeoff-header"><div><div class="eyebrow">CME material intelligence</div><h1>Project Takeoff</h1><p>${escapeHtml(documentModel.name)} · calculated from the current construction model</p></div><button class="takeoff-close" data-action="close-takeoff" aria-label="Close takeoff">×</button></header><div class="takeoff-view-mode"><div><strong>List format</strong><small>${modeHelp}</small></div><div class="segmented-control"><button class="button ${takeoffViewMode === 'detailed' ? 'active-constraint' : ''}" data-action="set-takeoff-view" data-view="detailed">Detailed by use</button><button class="button ${takeoffViewMode === 'consolidated' ? 'active-constraint' : ''}" data-action="set-takeoff-view" data-view="consolidated">Consolidated for purchase</button></div></div><div class="takeoff-summary"><span><small>Material lines</small><strong>${lines.length}</strong></span><span><small>Unpriced</small><strong>${unpriced}</strong></span><span class="takeoff-price"><small>Known material total</small><strong>$${knownTotal.toFixed(2)}</strong></span></div><div class="takeoff-actions"><button class="button primary" data-action="print-takeoff-quote">Export quote · no prices</button><button class="button" data-action="print-takeoff-priced">Export with prices</button><button class="button ghost" data-action="download-takeoff-json">Takeoff JSON</button></div><div class="takeoff-list">${categories}</div><footer class="takeoff-footer"><span>${takeoffViewMode === 'consolidated' ? 'Read-only purchase list. Return to Detailed by use to adjust modeled quantities.' : 'Quantities marked REVIEW are preliminary construction recipes and remain editable.'}</span><strong>${takeoffViewMode === 'consolidated' ? `${detailedLines.length} detailed lines → ${lines.length} purchase lines` : `${lines.filter((line) => line.origin === 'adjusted').length} adjusted · ${lines.filter((line) => line.origin === 'manual').length} manual`}</strong></footer></section>`;
}

function renderCatAreaContextPanel(region) {
  const visible = isCatBoundaryVisible(documentModel, region);
  const close = '<button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button>';
  return `<section class="context-object-panel cat-context"><div class="context-heading"><div><div class="eyebrow">Selected CAT area</div><h2>${formatSquareFeet(region.areaSquareInches)}</h2></div>${close}</div><div class="context-stat"><span>Source geometry</span><strong>${region.lineIds.length} CAT lines</strong><small>Derived automatically from one closed construction-line loop.</small></div><div class="context-actions"><button class="button ${dimensionLeaderMode?.referenceId === selected.id ? 'active-constraint' : ''}" data-action="reposition-dimension-arrow">Reposition arrow</button><button class="button" data-action="reset-dimension-arrow">Reset arrow</button></div><div class="context-actions"><button class="button" data-action="hide-selected-boundary" ${visible ? '' : 'disabled'}>${visible ? 'Hide this boundary' : 'Boundary hidden'}</button><button class="button" data-action="show-all-boundaries">Show all boundaries</button></div><div class="context-actions"><button class="button" data-action="reset-dimension-position">Reset area position</button><button class="button primary" data-action="convert-cat-boundary">Convert to Deck Boundary</button></div><div class="context-note">The CAT area annotation remains visible when its construction boundary is hidden, so it can always be restored or converted.</div></section>`;
}

function renderContextPanel(current) {
  if (!selected.kind) return '';
  if (selected.kind === 'framing') {
    const object = documentModel.objects.find((entry) => entry.id === selected.id && ['joist', 'beam', 'post', 'pillar'].includes(entry.type));
    if (!object) return '';
    const kindLabel = object.type === 'joist' ? 'Joist' : object.type === 'beam' ? 'Beam' : object.type === 'pillar' ? 'Pillar' : 'Post / Footing';
    const length = object.start && object.end ? Math.hypot(object.end.x - object.start.x, object.end.y - object.start.y) : 0;
    const layer = getFramingLayer(documentModel);
    const geometry = object.type === 'beam' ? deriveBeamGeometry(object, layer.settings, deriveBeamLoad(documentModel, object)) : null;
    const system = object.type === 'beam' ? framingSystem(object, layer.settings.framingSystem) : null;
    const material = object.type === 'beam' ? normalizeBeamMaterial(object.material, object.size) : null;
    const stock = object.type === 'beam' ? planBeamStock(length) : null;
    const joistAnalysis = object.type === 'joist' ? analyzeJoist(object) : null;
    const joistStock = joistAnalysis?.stock ?? null;
    const stockLabel = stock?.byLength.map((entry) => `${entry.quantity} × ${entry.lengthFeet}′`).join(' + ');
    const solidBeamOptions = BEAM_SIZE_PRESETS.filter((preset) => preset.construction === 'solid').map((preset) => `<option value="${preset.id}" ${material?.preset === preset.id ? 'selected' : ''}>${preset.label}</option>`).join('');
    const builtUpBeamOptions = BEAM_SIZE_PRESETS.filter((preset) => preset.construction === 'built-up').map((preset) => `<option value="${preset.id}" ${material?.preset === preset.id ? 'selected' : ''}>${preset.label}</option>`).join('');
    const beamStatus = geometry?.spanReference.engineeringReview ? '⚠ Engineering review' : '✓ CRC reference';
    const beamReasons = geometry?.spanReference.reasons.join(' ') || '2025 CRC Table R507.5(1), zero joist cantilever.';
    const beamOptions = geometry ? `<div class="context-stat"><span>Beam material</span><strong>${escapeHtml(beamMaterialLabel(material))}</strong><small>${stockLabel} · ${stock.wasteFeet.toFixed(2)} ft trim allowance</small></div><label class="context-select"><span>Nominal beam profile · pressure treated</span><select id="beam-size-preset"><optgroup label="Solid 4× · Engineering review">${solidBeamOptions}</optgroup><optgroup label="2025 CRC built-up beams">${builtUpBeamOptions}</optgroup><option value="custom" ${material.preset === 'custom' ? 'selected' : ''}>Custom · Engineering review</option></select></label><label class="context-select"><span>Custom material · used only when Custom is selected</span><div class="compound-field"><input id="beam-custom-size" value="${escapeHtml(material.customLabel)}" placeholder="Example: 6×12 DF #1"><button class="button" data-action="apply-beam-material">Apply</button></div></label><div class="context-stat ${geometry.spanReference.engineeringReview ? 'review' : ''}"><span>Beam span reference</span><strong>${beamStatus}</strong><small>${formatFeetInches(geometry.load.joistSpanFeet * 12)} tributary joist span · ${formatFeetInches(geometry.spanReference.maximumPostSpacingFeet * 12)} maximum post spacing. ${escapeHtml(beamReasons)}</small></div><div class="context-stat"><span>Live support layout</span><strong>${geometry.postCount} posts</strong><small>${formatFeetInches(geometry.spacingInches)} actual bay · ${geometry.footingSizeInches}″ footings</small></div><div class="context-actions"><button class="button ${system === 'bottom' ? 'active-constraint' : ''}" data-action="set-framing-system" data-system="bottom">Bottom beam</button><button class="button ${system === 'flush' ? 'active-constraint' : ''}" data-action="set-framing-system" data-system="flush">Flush beam</button></div><label class="context-select"><span>Posts · standard minimum ${geometry.minimumPostCount}</span><div class="compound-field"><input id="beam-post-count" type="number" min="${geometry.minimumPostCount}" value="${geometry.postCount}"><button class="button" data-action="apply-beam-posts">Apply</button></div></label>` : '';
    const postOptions = object.type === 'post' ? `<div class="context-stat"><span>Manual support assembly</span><strong>${escapeHtml(object.size ?? '4x4x8')} post · ${Number(object.footing?.sizeInches) || DEFAULT_MANUAL_FOOTING_SIZE_INCHES}″ footing</strong><small>Simpson Strong-Tie ABW Post Base · ${Number(object.footing?.concreteBags) || CONCRETE_BAGS_PER_POST} concrete bags in Takeoff</small></div>` : '';
    const spanCheck = joistAnalysis?.spanValidation;
    const joistNeedsReview = Boolean(joistStock?.needsReview || spanCheck?.valid === false || spanCheck?.valid === null);
    const joistOptions = joistStock ? `<div class="context-stat ${joistNeedsReview ? 'review' : ''}"><span>Continuous joist stock</span><strong>${joistStock.stockLengthFeet ? `${joistStock.stockLengthFeet}′ board` : '⚠ REVIEW · over 20′'}</strong><small>${formatFeetInches(length)} continuous cut · ${joistStock.stockLengthFeet ? `${joistStock.wasteFeet.toFixed(2)} ft reusable offcut` : 'no standard commercial board can make this without a designed splice'}</small></div><div class="context-stat ${spanCheck?.valid === false ? 'review' : ''}"><span>CRC 2025 span reference</span><strong>${spanCheck?.status === 'valid' ? '✓ Valid bays' : spanCheck?.status === 'near-limit' ? '△ Near limit' : spanCheck?.status === 'invalid' ? '⚠ Span exceeded' : 'REVIEW'}</strong><small>${spanCheck?.reference ? `${formatFeetInches(spanCheck.longestSpanInches)} longest bay · ${formatFeetInches(spanCheck.reference.maximumInches)} maximum at ${spanCheck.reference.spacingInches}″ O.C.` : escapeHtml(spanCheck?.reason ?? '')}</small></div>${joistNeedsReview ? `<button class="button context-full ${object.reviewIgnored ? 'active-constraint' : ''}" data-action="toggle-ignore-joist-review">${object.reviewIgnored ? '✓ Warning acknowledged' : 'Acknowledge warning'}</button>` : ''}` : '';
    const joistNominal = object.type === 'joist' ? normalizeJoistNominalSize(object.size) ?? '2x6' : null;
    const joistSpecies = object.type === 'joist' ? object.material?.speciesGroup ?? 'douglas-fir-larch' : null;
    const joistFieldId = object.type === 'joist' ? object.layout?.fieldId : null;
    const joistField = joistFieldId ? getJoists(documentModel).filter((joist) => joist.layout?.fieldId === joistFieldId) : [];
    const joistFieldSpacing = Number(joistField.find((joist) => !joist.layout?.manualParallel)?.layout?.spacingInches ?? object.layout?.spacingInches ?? DEFAULT_SPACING_INCHES);
    const blockingRows = joistFieldId ? deriveJoistBlockingRows(documentModel, { includeSuppressed: true }).filter((row) => row.fieldId === joistFieldId) : [];
    const suppressedBlocking = blockingRows.filter((row) => row.suppressed).length;
    const standardSpacing = [12, 16, 24].includes(joistFieldSpacing);
    const joistMeshOptions = joistFieldId ? `<div class="context-stat"><span>Joist Field</span><strong>${joistField.length} continuous members · ${joistFieldSpacing}″ O.C.</strong><small>${joistField.filter((joist) => joist.layout?.manualParallel).length} manually added · ${blockingRows.filter((row) => !row.suppressed).length} blocking rows</small></div><div class="context-actions"><button class="button ${joistMeshMoveMode?.fieldId === joistFieldId ? 'active-constraint' : ''}" data-action="move-joist-mesh">${joistMeshMoveMode?.fieldId === joistFieldId ? 'Move mesh active' : 'Move mesh'}</button><button class="button ${singleJoistMode?.fieldId === joistFieldId ? 'active-constraint' : ''}" data-action="add-single-joist">${singleJoistMode?.fieldId === joistFieldId ? 'Place single joist' : '+ Single joist'}</button></div><div class="context-actions"><button class="button ${blockingAddMode?.fieldId === joistFieldId ? 'active-constraint' : ''}" data-action="add-blocking-row">${blockingAddMode?.fieldId === joistFieldId ? 'Place blocking row' : '+ Blocking row'}</button>${suppressedBlocking ? `<button class="button" data-action="restore-blocking-rows">Restore ${suppressedBlocking} automatic</button>` : '<button class="button" disabled>Automatic blocking active</button>'}</div><div class="context-stat"><span>Entire field spacing</span><strong>${joistFieldSpacing}″ on centre</strong><small>Regenerates the complete array, Blocking, span validation, and Takeoff.</small></div><div class="context-actions context-actions-3">${[12, 16, 24].map((spacing) => `<button class="button ${joistFieldSpacing === spacing ? 'active-constraint' : ''}" data-action="set-joist-field-spacing" data-spacing="${spacing}">${joistFieldSpacing === spacing ? '✓ ' : ''}${spacing}″ O.C.</button>`).join('')}</div><label class="context-select"><span>Custom spacing · 1″–48″ O.C.</span><div class="compound-field"><input id="joist-field-custom-spacing" type="number" min="1" max="48" step="0.25" value="${standardSpacing ? '' : joistFieldSpacing}" placeholder="Example: 19.2"><button class="button" data-action="set-joist-field-spacing" data-spacing="custom">Apply</button></div></label>` : '';
    const joistStandardEditor = joistFieldId ? `<div class="context-stat"><span>Entire field profile</span><strong>${escapeHtml(object.size ?? '2×6 PT')}</strong><small>Profile changes apply to every joist in this array; individual profile overrides are not allowed.</small></div><div class="context-actions"><label class="context-select"><span>Nominal joist size</span><select id="joist-nominal-size">${['2x6', '2x8', '2x10', '2x12'].map((size) => `<option value="${size}" ${joistNominal === size ? 'selected' : ''}>${size.replace('x', '×')} PT</option>`).join('')}</select></label><label class="context-select"><span>Lumber span group</span><select id="joist-species-group"><option value="douglas-fir-larch" ${joistSpecies === 'douglas-fir-larch' ? 'selected' : ''}>Douglas Fir-Larch / Hem-Fir / SPF</option><option value="redwood" ${joistSpecies === 'redwood' ? 'selected' : ''}>Redwood / Western Cedar</option></select></label></div><button class="button primary context-full" data-action="apply-joist-standard">Apply profile to entire Joist Field</button>` : '';
    const sizeEditor = !['beam', 'joist'].includes(object.type) ? `<label class="context-select"><span>Size label · selected by estimator</span><div class="compound-field"><input id="framing-size" value="${escapeHtml(object.size ?? '')}" placeholder="2×10, 6×6…"><button class="button" data-action="apply-framing-size">Apply</button></div></label>` : '';
    const deleteControls = object.type === 'joist' && joistFieldId ? `<div class="context-actions"><button class="button danger" data-action="delete-framing">Delete selected joist</button><button class="button danger" data-action="delete-joist-field">Delete entire Joist Field</button></div>` : `<button class="button danger context-full" data-action="delete-framing">Delete ${kindLabel.toLowerCase()}</button>`;
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">${object.type === 'joist' && joistFieldId ? 'Selected joist · Joist Field controls' : 'Selected framing object'}</div><h2>${length ? formatFeetInches(length) : kindLabel}</h2></div><button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button></div>${beamOptions}${postOptions}${joistOptions}${joistMeshOptions}${joistStandardEditor}${sizeEditor}${object.type === 'beam' ? `<div class="context-stat"><span>Repeat setup</span><strong>${framingSpacing}″ O.C.</strong><small>${framingCopies} copies · clipped to active deck</small></div><button class="button context-full" data-action="framing-array">Repeat selected member</button>` : ''}${deleteControls}<div class="context-note">${object.type === 'beam' ? 'Drag either highlighted Beam endpoint to edit its length and angle. Supports and Takeoff recalculate in real time.' : object.type === 'joist' ? 'Delete selected removes only this physical member. Profile and spacing are controlled by the full Joist Field to prevent inconsistent framing.' : object.type === 'post' ? 'Place this assembly beneath a Beam or Rim / Flush where an additional field support is required.' : 'This framing object remains part of the serializable project model.'}</div></section>`;
  }
  if (selected.kind === 'blocking') {
    const row = deriveJoistBlockingRows(documentModel, { includeSuppressed: true }).find((entry) => entry.id === selected.id);
    if (!row) return '';
    const total = row.segments.reduce((sum, segment) => sum + segment.cutLengthInches, 0);
    const type = row.kind === 'bottom-beam' ? 'Fixed · Bottom Beam' : row.kind === 'span' ? 'Automatic · span rule' : 'Manual blocking row';
    const blockingSize = row.blockingMaterial?.size ?? '2×6 PT';
    const override = row.blockingMaterial?.source === 'override';
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected joist blocking</div><h2>${escapeHtml(type)}</h2></div><button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button></div><div class="context-stat"><span>Blocking cuts</span><strong>${row.segments.length} pieces</strong><small>${formatFeetInches(total)} net · packed into 16 ft stock in Takeoff</small></div><label class="context-select"><span>Blocking material · entire Joist Field</span><div class="compound-field"><select id="blocking-material-size"><option value="match" ${override ? '' : 'selected'}>Match Joist Field · ${escapeHtml(blockingSize)}</option>${['2×6 PT', '2×8 PT', '2×10 PT', '2×12 PT'].map((size) => `<option value="${size}" ${override && blockingSize === size ? 'selected' : ''}>${size}</option>`).join('')}</select><button class="button" data-action="apply-blocking-material">Apply</button></div></label>${row.suppressed ? '<div class="validation error"><span class="validation-dot"></span><span>This automatic row is suppressed and excluded from Takeoff.</span></div>' : ''}${row.automatic ? `<button class="button ${row.suppressed ? 'primary' : 'danger'} context-full" data-action="${row.suppressed ? 'restore-selected-blocking' : 'suppress-blocking-row'}">${row.suppressed ? 'Restore automatic row' : 'Suppress automatic row'}</button>` : `<div class="context-actions"><button class="button ${blockingMoveMode?.rowId === row.id ? 'active-constraint' : ''}" data-action="move-blocking-row">${blockingMoveMode?.rowId === row.id ? 'Move row active' : 'Move row'}</button><button class="button danger" data-action="delete-blocking-row">Delete row</button></div>`}<div class="context-note">By default every row uses the dominant material of its Joist Field. An explicit override applies to all blocking in that field.</div></section>`;
  }
  if (selected.kind === 'cat') {
    const object = documentModel.objects.find((entry) => entry.id === selected.id && [CAT_LINE_TYPE, CAT_MEASUREMENT_TYPE, CAT_NOTE_TYPE].includes(entry.type));
    if (!object) return '';
    const measurement = object.type === CAT_MEASUREMENT_TYPE ? deriveCatMeasurement(object) : null;
    const note = object.type === CAT_NOTE_TYPE ? object : null;
    const lineGeometry = object.type === CAT_LINE_TYPE ? deriveCatLineGeometry(object) : null;
    const title = note ? catNoteLabel(note) : measurement ? formatFeetInches(measurement.pointToPointDistance) : formatFeetInches(lineGeometry.length);
    const annotation = Boolean(note || measurement);
    const arcControls = lineGeometry ? `<div class="context-actions"><button class="button ${catArchMode?.lineId === object.id ? 'active-constraint' : ''}" data-action="start-cat-arch-line">${lineGeometry.kind === 'arc' ? 'Reshape arch' : 'Convert to arch'}</button><button class="button" data-action="straighten-cat-line" ${lineGeometry.kind === 'arc' ? '' : 'disabled'}>Straighten</button></div>${lineGeometry.kind === 'arc' ? `<div class="context-stat"><span>CAT arc</span><strong>${formatFeetInches(lineGeometry.length)}</strong><small>R ${formatFeetInches(lineGeometry.radius)} · H ${formatInches(Math.abs(lineGeometry.sagitta))}</small></div>` : ''}` : '';
    return `<section class="context-object-panel cat-context"><div class="context-heading"><div><div class="eyebrow">${note ? 'CAT construction note' : measurement ? 'CAT measuring tape' : 'CAT construction line'}</div><h2>${title}</h2></div><button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button></div>${arcControls}${note ? `<label class="context-select"><span>Estimator note</span><textarea id="cat-note-text" rows="4" maxlength="1000">${escapeHtml(note.text)}</textarea></label><button class="button primary context-full" data-action="apply-cat-note">Save note</button><div class="context-actions"><button class="button ${catAudioRecorder ? 'active-constraint' : ''}" data-action="${catAudioRecorder ? 'stop-cat-note-audio' : 'record-cat-note-audio'}">${catAudioRecorder ? '■ Stop recording' : '● Record voice'}</button><button class="button" data-action="remove-cat-note-audio" ${note.audioDataUrl ? '' : 'disabled'}>Delete audio</button></div>${note.audioDataUrl ? `<audio class="cat-note-audio" controls src="${note.audioDataUrl}"></audio>` : '<div class="context-note">Optional voice note · recording stops automatically after 30 seconds.</div>'}` : measurement ? `<div class="cat-measure-summary"><span><small>Horizontal</small><strong>${formatFeetInches(measurement.horizontalDistance)}</strong></span><span><small>Vertical</small><strong>${formatFeetInches(measurement.verticalDistance)}</strong></span><span><small>Point to point</small><strong>${formatFeetInches(measurement.pointToPointDistance)}</strong></span></div>` : '<div class="context-note">CAT reference geometry remains separate from authoritative construction objects and is available to Boundary snap.</div>'}<div class="context-actions"><button class="button" data-action="${annotation ? 'toggle-cat-dimensions' : 'toggle-cat-construction-lines'}">${annotation ? getCatDimensionLayer(documentModel).visible ? 'Hide CAT annotations' : 'Show CAT annotations' : getCatConstructionLayer(documentModel).visible ? 'Hide CAT CL' : 'Show CAT CL'}</button><button class="button danger" data-action="delete-cat-object">Delete</button></div></section>`;
  }
  if (selected.kind === 'cat-boundary') {
    const region = deriveCatBoundaries(documentModel).find((entry) => entry.id === selected.id);
    if (!region) return '';
    return `<section class="context-object-panel cat-context"><div class="context-heading"><div><div class="eyebrow">Closed CAT Boundary</div><h2>${formatSquareFeet(region.areaSquareInches)}</h2></div><button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button></div><div class="context-stat"><span>Source geometry</span><strong>${region.lineIds.length} CAT lines</strong><small>Derived automatically from one closed construction-line loop.</small></div><button class="button primary context-full" data-action="convert-cat-boundary">Convert to Deck Boundary</button><div class="context-note">Conversion preserves CAT arcs, creates an authoritative Deck Boundary, and removes only the CAT lines that formed this region.</div></section>`;
  }
  if (selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind === 'cat-area') return renderCatAreaContextPanel(reference.region);
  }
  if (!current) return '';
  const deckingVisible = getDeckingLayer(documentModel).visible;
  const close = '<button class="context-close" data-action="clear-selection" aria-label="Close object options">×</button>';
  if (selected.kind === 'railing-post') {
    const post = findRailingPost(selected.id);
    if (!post) return '';
    const projectPosts = getRailingPostLayout().physicalPostCount;
    const cornerControls = post.corner
      ? `<button class="button context-full ${post.doubled ? 'active-constraint' : ''}" data-action="toggle-double-railing-corner" aria-pressed="${post.doubled}">${post.doubled ? '✓ Double post corner' : 'Double post corner'}</button><div class="context-note">A double corner creates two visible 4×4 posts separated by one post width. CME equalizes both runs and Takeoff follows the final visible layout, including any intermediate post that becomes unnecessary.</div>`
      : '<div class="context-note">This is one visible railing post. Double corner is available only where two railing runs meet in different directions.</div>';
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected railing post</div><h2>${post.doubled ? 'Double corner post' : post.shared ? 'Shared railing post' : 'Railing post'}</h2></div>${close}</div><div class="context-stat"><span>Visible post assembly</span><strong>${post.markers.length} post${post.markers.length === 1 ? '' : 's'}</strong><small>${projectPosts} visibly modeled posts included in Takeoff</small></div>${cornerControls}</section>`;
  }
  if (selected.kind === 'railing') {
    const geometry = findResolvedRailingGeometry(selected.id) ?? findRailingGeometry(selected.id);
    if (!geometry) return '';
    const system = geometry.railing.settings?.system ?? 'wild-hog';
    const canRemovePanel = geometry.sectionCount > geometry.minimumSectionCount;
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected railing</div><h2>${formatFeetInches(geometry.sourceLength ?? geometry.length)}</h2></div>${close}</div><div class="context-stat"><span>Equalized panels</span><strong>${geometry.sectionCount}</strong><small>${geometry.postCount} positions on this run · ${formatFeetInches(geometry.clearSpan)} clear span</small></div><div class="context-stepper"><button class="button" data-action="remove-railing-panel" ${canRemovePanel ? '' : 'disabled'}>− Panel</button><button class="button" data-action="add-railing-panel">+ Panel</button></div><label class="context-select"><span>Railing type</span><select id="quick-railing-system"><option value="wild-hog" ${system === 'wild-hog' ? 'selected' : ''}>Wild Hog panel</option><option value="trex" ${system === 'trex' ? 'selected' : ''}>Trex railing</option></select></label><div class="context-actions"><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide all decking' : 'Show all decking'}</button><button class="button danger" data-action="remove-railing">Delete railing</button></div><div class="context-note">Moving a corner post regenerates equal spacing. If the shorter usable run remains under the 6 ft clear-span rule, CME may remove an unnecessary intermediate post and update Takeoff.</div></section>`;
  }
  if (selected.kind === 'edge') {
    const edge = current.edges.find((entry) => entry.id === selected.id);
    if (!edge) return '';
    const arc = getBoundaryArc(current, edge.id);
    if (arc) {
      const arcProperties = normalizeBoundaryEdge(arc.record.originalEdge).properties;
      const curvedRim = normalizeRimJoist(arcProperties.attachments.rimJoist);
      const inheritedSize = dominantBoundaryJoistSize(documentModel, current.id);
      const curvedStock = curvedRim.enabled ? planBeamStock(arc.length) : null;
      return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Curved deck boundary</div><h2>Arch line</h2></div>${close}</div><div class="context-actions"><button class="button ${archMode ? 'active-constraint' : ''}" data-action="start-arch-line">Arch line · reshape</button><button class="button" data-action="straighten-arch-line">Straighten</button></div><button class="button context-full ${curvedRim.enabled ? 'active-constraint' : ''}" data-action="quick-rim-joist" aria-pressed="${curvedRim.enabled}">${curvedRim.enabled ? '✓ Curved rim joist' : 'Convert to curved rim joist'}</button>${curvedRim.enabled ? `<div class="context-stat"><span>Curved boundary framing</span><strong>${escapeHtml(inheritedSize)}</strong><small>${curvedStock.byLength.map((entry) => `${entry.quantity} × ${entry.lengthFeet}′`).join(' + ')} · follows this Deck Boundary Joist Field</small></div>` : ''}<div class="context-actions"><button class="button ${arcProperties.finishes.fascia ? 'active-constraint' : ''}" data-action="quick-fascia">Fascia</button><button class="button ${arcProperties.finishes.pictureFrame ? 'active-constraint' : ''}" data-action="quick-picture-frame">Picture frame</button></div><div class="context-stat"><span>Arc length</span><strong>${formatFeetInches(arc.length, .0625)}</strong></div><div class="context-stat"><span>Radius · R</span><strong>${formatFeetInches(arc.radius, .0625)}</strong></div><div class="context-stat"><span>Chord midpoint → arc midpoint · H</span><strong>${formatInches(Math.abs(arc.sagitta))}</strong></div><div class="context-note">The curved rim follows the dominant Joist Field profile and uses the true arc length in Takeoff. Curved framing and heat-bent composite require fabrication review.</div></section>`;
    }
    const index = current.edges.findIndex((entry) => entry.id === edge.id);
    const length = Math.hypot(current.vertices[(index + 1) % current.vertices.length].x - current.vertices[index].x, current.vertices[(index + 1) % current.vertices.length].y - current.vertices[index].y);
    const properties = normalizeBoundaryEdge(edge).properties;
    const dimensionVisible = getDimensionLayer(documentModel).visible && isDimensionReferenceVisible(documentModel, edge.id);
    const breakDisabled = edgeHasRailingDependency(edge.id);
    const locked = isEdgeLocked(current, edge.id);
    const orientation = getEdgeOrientationConstraint(current, edge.id);
    const orientationStatus = describeOrientationConstraint(orientation);
    const ledger = edge.role === 'house' && properties.attachments.ledger !== false;
    const rimJoist = normalizeRimJoist(properties.attachments.rimJoist);
    const rimStock = rimJoist.enabled ? planBeamStock(length) : null;
    const rimOptions = rimJoist.enabled ? `<div class="context-stat"><span>Boundary framing</span><strong>${escapeHtml(rimJoistLabel(rimJoist))}${rimJoist.plyCount === 2 ? ' · DOUBLE' : ''}</strong><small>${rimStock.byLength.map((entry) => `${entry.quantity * rimJoist.plyCount} × ${entry.lengthFeet}′`).join(' + ')} · joists terminate at this edge</small></div><label class="context-select"><span>Nominal rim / flush size</span><select id="rim-joist-size-preset">${RIM_JOIST_SIZE_PRESETS.map((preset) => `<option value="${preset.id}" ${rimJoist.preset === preset.id ? 'selected' : ''}>${preset.label}</option>`).join('')}<option value="custom" ${rimJoist.preset === 'custom' ? 'selected' : ''}>Custom</option></select></label><label class="context-select"><span>Custom material · used only when Custom is selected</span><div class="compound-field"><input id="rim-joist-custom-size" value="${escapeHtml(rimJoist.customLabel)}" placeholder="Example: 3×12 DF #1"><button class="button" data-action="apply-rim-joist-material">Apply</button></div></label><button class="button context-full ${rimJoist.plyCount === 2 ? 'active-constraint' : ''}" data-action="toggle-double-rim-joist" aria-pressed="${rimJoist.plyCount === 2}">${rimJoist.plyCount === 2 ? '✓ Double joist' : 'Double joist'}</button>` : '';
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected construction edge</div><h2>${locked ? '⚓ ' : orientation?.type === 'fixed-angle' ? '⚓∠ ' : orientation?.type === 'horizontal' ? 'H · ' : orientation?.type === 'vertical' ? 'V · ' : ''}${formatFeetInches(length)}</h2></div>${close}</div><div class="context-actions"><button class="button ${locked ? 'active-constraint' : ''}" data-action="${locked ? 'unlock-edge' : 'lock-edge'}">${locked ? '✓ Edge locked' : 'Lock edge'}</button><button class="button ${dimensionLeaderMode?.referenceId === edge.id ? 'active-constraint' : ''}" data-action="reposition-dimension-arrow">Reposition arrow</button></div><div class="context-actions context-actions-3 orientation-toggle" role="group" aria-label="Edge orientation"><button class="button ${orientation?.type === 'vertical' ? 'active-constraint' : ''}" data-action="constraint-vertical" aria-pressed="${orientation?.type === 'vertical'}" ${locked ? 'disabled' : ''}>${orientation?.type === 'vertical' ? '✓ ' : ''}Vertical</button><button class="button ${orientation?.type === 'horizontal' ? 'active-constraint' : ''}" data-action="constraint-horizontal" aria-pressed="${orientation?.type === 'horizontal'}" ${locked ? 'disabled' : ''}>${orientation?.type === 'horizontal' ? '✓ ' : ''}Horizontal</button><button class="button ${orientation?.type === 'fixed-angle' ? 'active-constraint' : ''}" data-action="constraint-lock-angle" aria-pressed="${orientation?.type === 'fixed-angle'}" ${locked ? 'disabled' : ''}>${orientation?.type === 'fixed-angle' ? '✓ ' : ''}Lock angle</button></div><div class="constraint-status ${orientation ? 'active' : ''}"><span>${orientation ? '●' : '○'}</span>${locked ? 'Full edge lock active' : orientationStatus}</div><div class="context-actions context-actions-3"><button class="button ${dimensionVisible ? '' : 'primary'}" data-action="toggle-selected-dimension">${dimensionVisible ? 'Delete dimension' : 'Add dimension'}</button><button class="button" data-action="break-edge-2" ${breakDisabled || locked ? 'disabled' : ''}>Break ×2</button><button class="button" data-action="break-edge-3" ${breakDisabled || locked ? 'disabled' : ''}>Break ×3</button></div><div class="context-actions context-actions-3"><button class="button ${edge.role === 'house' ? 'house-relationship-active' : ''}" data-action="quick-house-attachment" aria-pressed="${edge.role === 'house'}">${edge.role === 'house' ? '✓ ' : ''}House attachment</button><button class="button ${ledger ? 'active-constraint' : ''}" data-action="quick-ledger" aria-pressed="${ledger}" ${edge.role === 'house' ? '' : 'disabled'}>${ledger ? '✓ ' : ''}Ledger</button><button class="button ${rimJoist.enabled ? 'active-constraint' : ''}" data-action="quick-rim-joist" aria-pressed="${rimJoist.enabled}">${rimJoist.enabled ? '✓ ' : ''}Rim / flush</button></div><button class="button context-full ${archMode?.edgeId === edge.id ? 'active-constraint' : ''}" data-action="start-arch-line" ${locked ? 'disabled' : ''}>Arch line</button>${rimOptions}<div class="context-actions"><button class="button ${properties.finishes.fascia ? 'active-constraint' : ''}" data-action="quick-fascia">Fascia</button><button class="button ${properties.finishes.pictureFrame ? 'active-constraint' : ''}" data-action="quick-picture-frame">Picture frame</button></div><button class="button context-full" data-action="toggle-decking">${deckingVisible ? 'Hide all decking' : 'Show all decking'}</button>${rimJoist.enabled ? '<div class="context-note">Rim joist / flush beam enriches this Boundary edge; it does not create overlapping geometry.</div>' : ledger ? '<div class="context-note">Ledger active · Takeoff buys Simpson SDWS Timber Screw 5″ in 50-piece boxes and always rounds up.</div>' : locked ? '<div class="context-note">This edge cannot move, change length, split, or accept geometry constraints until unlocked.</div>' : breakDisabled ? '<div class="context-note">Remove connected railing before dividing this edge.</div>' : ''}</section>`;
  }
  if (selected.kind === 'stair-edge') {
    const reference = findStairInterfaceByEdgeId(selected.id);
    if (!reference) return '';
    const properties = normalizeBoundaryEdge(reference.edge).properties;
    const dimensionVisible = getDimensionLayer(documentModel).visible && isDimensionReferenceVisible(documentModel, reference.edge.id);
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected stair interface</div><h2>Deck–Stair line</h2></div>${close}</div><div class="context-actions"><button class="button ${dimensionVisible ? '' : 'primary'}" data-action="toggle-selected-dimension">${dimensionVisible ? 'Delete dimension' : 'Add dimension'}</button><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide decking' : 'Show decking'}</button></div><div class="context-actions"><button class="button ${properties.finishes.fascia ? 'active-constraint' : ''}" data-action="quick-fascia">Fascia</button><button class="button ${properties.finishes.pictureFrame ? 'active-constraint' : ''}" data-action="quick-picture-frame">Picture frame</button></div></section>`;
  }
  if (selected.kind === 'stair-side') {
    const reference = findStairSide(selected.id);
    if (!reference) return '';
    const snapped = reference.side === 'start' ? reference.stair.dimensions.snappedStart : reference.stair.dimensions.snappedEnd;
    const boundaryAttached = Boolean(reference.stair.sideAttachments?.[reference.side]);
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected stair side</div><h2>${reference.side === 'start' ? 'Left' : 'Right'} side · ${formatFeetInches(reference.stair.dimensions.totalRun)}</h2></div>${close}</div><div class="constraint-status active"><span>●</span>${snapped ? 'Snapped to base node · drag away to detach' : boundaryAttached ? 'Shared boundary connection · drag away to detach' : 'Drag sideways to change stair width'}</div><div class="context-actions"><button class="button" data-action="select-stair-object">Stair properties</button><button class="button danger" data-action="delete-stair">Delete stairs</button></div></section>`;
  }
  if (selected.kind === 'vertex') {
    const locked = isVertexLocked(current, selected.id);
    const index = current.vertices.findIndex((vertex) => vertex.id === selected.id);
    const adjacentLocked = [current.edges[index], current.edges[(index - 1 + current.edges.length) % current.edges.length]].some((edge) => isEdgeLocked(current, edge.id));
    const referenced = isVertexReferencedByAttachment(selected.id);
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected corner</div><h2>${locked ? '⚓ Locked node' : 'Boundary node'}</h2></div>${close}</div><div class="context-actions"><button class="button primary" data-action="start-45-chamfer" ${locked || adjacentLocked || referenced ? 'disabled' : ''}>45° Chamfer</button><button class="button ${locked ? 'active-constraint' : ''}" data-action="${locked ? 'unlock-vertex' : 'lock-vertex'}">${locked ? 'Unlock' : 'Lock in place'}</button></div><div class="context-actions"><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide decking' : 'Show decking'}</button><button class="button danger" data-action="delete-vertex" ${current.vertices.length <= 3 || locked || adjacentLocked || referenced ? 'disabled' : ''}>Delete node</button></div><div class="context-note">${referenced ? 'This node anchors another construction object and cannot be replaced.' : '45° Chamfer: drag anywhere to set an equal setback on both connected edges with live dimensions.'}</div></section>`;
  }
  if (selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind === 'stair') return renderStairContextPanel(reference.stair, deckingVisible, close);
    if (reference?.kind === 'area') {
      const localBoundary = reference.boundary;
      const levelDown = getBoundaryLevelDown(localBoundary);
      const boarding = getDeckBoarding(localBoundary);
      const assemblyLocked = localBoundary.vertices.some((vertex) => vertex.locked) || localBoundary.edges.some((edge) => edge.properties?.custom?.locked);
      const deleting = pendingDeckDeleteId === localBoundary.id;
      const boardingActive = boardingDirectionMode?.boundaryId === localBoundary.id;
      return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected deck area</div><h2>${formatSquareFeet(localBoundary.computed.areaSquareInches)}${levelDown > 0 ? ` · ↓ ${formatInches(levelDown)}` : ''}</h2></div>${close}</div><label class="context-select"><span>Down level · local deck</span><div class="compound-field"><input id="boundary-level-down" value="${formatInches(levelDown)}"><button class="button" data-action="apply-boundary-level">Apply</button></div></label><div class="context-actions"><button class="button primary ${moveBoundaryMode?.boundaryId === localBoundary.id ? 'active-constraint' : ''}" data-action="move-deck-area" ${assemblyLocked ? 'disabled' : ''}>Move deck area</button><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide all decking' : 'Show all decking'}</button></div><div class="context-actions"><button class="button" data-action="make-boundary-90">Make 90° corners</button><button class="button" data-action="start-level-down">Add level down</button></div><div class="context-actions context-actions-3"><button class="button ${boardingActive ? 'active-constraint' : ''}" data-action="set-board-direction">${boardingActive ? '✓ Select line / curve' : boarding ? 'Change direction' : 'Board direction'}</button><button class="button" data-action="rotate-board-direction" ${boarding && boarding.pattern !== 'curved' ? '' : 'disabled'}>Rotate 90°</button><button class="button" data-action="clear-board-direction" ${boarding ? '' : 'disabled'}>Clear boards</button></div><div class="context-actions"><button class="button ${dimensionLeaderMode?.referenceId === selected.id ? 'active-constraint' : ''}" data-action="reposition-dimension-arrow">Reposition arrow</button><button class="button" data-action="reset-dimension-arrow">Reset arrow</button></div><div class="context-actions"><button class="button" data-action="hide-selected-boundary" ${isDeckBoundaryVisible(localBoundary) ? '' : 'disabled'}>${isDeckBoundaryVisible(localBoundary) ? 'Hide this boundary' : 'Boundary hidden'}</button><button class="button" data-action="show-all-boundaries">Show all boundaries</button></div><div class="context-actions"><button class="button danger" data-action="toggle-selected-dimension">Delete dimension</button><button class="button" data-action="reset-dimension-position">Reset area position</button></div>${deleting ? '<div class="delete-confirmation"><strong>Delete this complete deck area?</strong><span>Attached stairs, railings, Level Down objects, and local dimensions will also be removed.</span><div class="context-actions"><button class="button danger" data-action="confirm-delete-deck">Confirm delete</button><button class="button" data-action="cancel-delete-deck">Cancel</button></div></div>' : '<button class="button danger context-full" data-action="request-delete-deck">Delete deck area</button>'}<div class="context-note">${assemblyLocked ? 'Unlock local nodes and edges before moving this deck.' : boarding ? boarding.pattern === 'curved' ? `Curved boarding follows concentric rows with a ${formatInches(boarding.boardWidth)} board and ${formatInches(boarding.gap)} gap.` : `Boarding follows a ${formatInches(boarding.boardWidth)} board with a ${formatInches(boarding.gap)} gap.` : 'Select Board direction, then touch any straight construction line or curved Deck Boundary edge.'}</div></section>`;
    }
    if (reference?.kind === 'level-down-area') return renderLevelDownContext(reference.levelDown, reference.region, deckingVisible, close, true);
    return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected annotation</div><h2>Dimension</h2></div>${close}</div><div class="context-actions"><button class="button primary" data-action="edit-dimension">Edit object</button><button class="button" data-action="reset-dimension-position">Reset position</button></div><div class="context-actions"><button class="button ${dimensionLeaderMode?.referenceId === selected.id ? 'active-constraint' : ''}" data-action="reposition-dimension-arrow">Reposition arrow</button><button class="button" data-action="reset-dimension-arrow">Reset arrow</button></div><button class="button danger context-full" data-action="toggle-selected-dimension">Delete dimension</button></section>`;
  }
  if (selected.kind === 'level-down') {
    const reference = findLevelDownSegment(selected.id);
    if (!reference) return '';
    return renderLevelDownContext(reference.levelDown, deriveLevelDownRegion(reference.levelDown, current), deckingVisible, close, false, reference.length);
  }
  if (selected.kind === 'stair') {
    const stair = documentModel.objects.find((object) => object.type === 'stair' && object.id === selected.id);
    return stair ? renderStairContextPanel(stair, deckingVisible, close) : '';
  }
  return '';
}

function renderStairContextPanel(stair, deckingVisible, close) {
  const invalid = stair.lifecycle?.needsReview;
  const riserCount = stair.dimensions.riserCount ?? stair.dimensions.stepCount;
  const treadCount = stair.dimensions.treadCount ?? riserCount - 1;
  const framing = deriveStairFraming(stair);
  const stringerStock = framing.stringerStockLengthFeet ? `${framing.stringerStockLengthFeet}′ continuous stock` : '⚠ Over 20′ stock';
  return `<section class="context-object-panel stair-context ${invalid ? 'invalid-stair' : ''}"><div class="context-heading"><div><div class="eyebrow">${invalid ? 'Stair needs review' : 'Selected staircase'}</div><h2>${escapeHtml(stair.name)}</h2></div>${close}</div>${renderStairCoveringControls(stair)}${invalid ? `<div class="validation error"><span class="validation-dot"></span><span>${escapeHtml(stair.lifecycle.reviewReason ?? 'No valid stair layout remains.')}</span></div>` : ''}<div class="context-stat"><span>Total run</span><strong>${formatFeetInches(stair.dimensions.totalRun, .25)}</strong><small>${riserCount}R · ${treadCount}T</small></div><div class="context-stat ${framing.needsReview ? 'review' : ''}"><span>2×12 PT stair framing</span><strong>${framing.stringerCount} stringers · ${stringerStock}</strong><small>2 sides + ${framing.internalStringerCount} internal · ${formatInches(framing.actualSpacingInches)} max O.C.${framing.pictureFrame ? ' · Supports 6.5″ from each edge' : ''} · ${formatFeetInches(framing.stringerLengthInches, .25)} sloped length</small></div><div class="context-stat"><span>Top ledger / header</span><strong>2×12 PT · ${formatFeetInches(framing.ledgerLengthInches, .25)}</strong><small>${framing.ledgerStockPieces.map((length) => `${length}′`).join(' + ')} stock · Takeoff updates with stair geometry</small></div>${framing.lowerMembers.map((member) => `<div class="context-stat"><span>${member.role === 'lower-closure' ? 'Lower riser closure' : 'Bottom tie / sole plate'}</span><strong>${member.material} · ${formatFeetInches(member.lengthInches, .25)}</strong><small>${member.stockLengthFeet ? `${member.stockLengthFeet}′ stock` : 'REVIEW · exceeds stock'} · Full stair width</small></div>`).join('')}<div class="field-grid stair-edit-grid"><div class="field"><label for="stair-total-rise">Total rise</label><input id="stair-total-rise" value="${formatInches(stair.dimensions.totalRise)}" ${stair.destination ? 'disabled' : ''}></div><div class="field"><label for="stair-riser-height">Riser</label><input id="stair-riser-height" value="${formatInches(stair.dimensions.riserHeight)}"></div><div class="field full"><label for="stair-tread-depth">Tread depth · default 11″ (10–11″)</label><div class="compound-field"><input id="stair-tread-depth" value="${formatInches(stair.dimensions.treadDepth)}"><button class="button" data-action="apply-stair-dimensions">Apply</button></div></div></div><div class="context-actions"><button class="button" data-action="select-stair-interface">Select deck interface</button><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide decking' : 'Show decking'}</button></div><button class="button danger context-full" data-action="delete-stair">Delete stairs</button><div class="context-note">${stair.destination ? 'Total rise follows the connected deck levels. CME recalculates first and marks the stair red only when no valid landing remains.' : 'Risers stay between 5″ and 7.5″; treads stay between 10″ and 11″.'}</div></section>`;
}

function refreshContextPanel() {
  const inspector = app.querySelector('.inspector');
  if (!inspector) return;
  inspector.querySelector(':scope > .context-object-panel')?.remove();
  const markup = renderContextPanel(boundary());
  if (!markup) return;
  inspector.insertAdjacentHTML('afterbegin', markup);
  const panel = inspector.querySelector(':scope > .context-object-panel');
  panel?.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action, button)));
}

function renderLevelDownContext(levelDown, region, deckingVisible, close, selectedByDimension, segmentLength = null) {
  const finishes = levelDown.properties?.finishes ?? {};
  const totalDepth = getLevelDownDepth(levelDown);
  return `<section class="context-object-panel"><div class="context-heading"><div><div class="eyebrow">Selected lowered area</div><h2>${region ? formatSquareFeet(region.areaSquareInches) : formatFeetInches(segmentLength ?? 0)}</h2></div>${close}</div><div class="context-stat"><span>Below main deck</span><strong>${formatInches(totalDepth)}</strong><small>Includes overlapping level changes</small></div><label class="context-select"><span>This step drop · entire polyline</span><div class="compound-field"><input id="quick-level-down-riser" value="${formatInches(levelDown.dimensions.riserHeight)}"><button class="button" data-action="apply-level-down-riser">Apply</button></div></label><div class="context-actions context-actions-3"><button class="button" data-action="make-level-down-90">Make 90°</button><button class="button ${finishes.pictureFrame ? 'active-constraint' : ''}" data-action="quick-level-picture-frame">Picture frame</button><button class="button ${finishes.fascia ? 'active-constraint' : ''}" data-action="quick-level-fascia">Fascia</button></div><div class="context-actions"><button class="button" data-action="flip-level-down-side">Flip lowered side</button><button class="button" data-action="toggle-decking">${deckingVisible ? 'Hide all decking' : 'Show all decking'}</button></div>${selectedByDimension ? `<div class="context-actions"><button class="button danger" data-action="toggle-selected-dimension">Delete dimension</button><button class="button" data-action="reset-dimension-position">Reset position</button></div><div class="context-actions"><button class="button ${dimensionLeaderMode?.referenceId === selected.id ? 'active-constraint' : ''}" data-action="reposition-dimension-arrow">Reposition arrow</button><button class="button" data-action="reset-dimension-arrow">Reset arrow</button></div>` : '<div class="context-actions"><button class="button" data-action="break-level-down-2">Break ×2</button><button class="button" data-action="break-level-down-3">Break ×3</button></div>'}<button class="button danger context-full" data-action="delete-level-down">Delete lowered area</button><div class="context-note">The arrow dimension owns this lowered area. Moving it draws a live leader back to the region.</div></section>`;
}

function renderUtilityPopover() {
  if (!utilityPanel) return '';
  const content = utilityPanel === 'visibility' ? renderVisibilityControls() : renderSnapControls();
  return `<div class="utility-popover ${utilityPanel}" role="dialog" aria-label="${utilityPanel === 'visibility' ? 'Drawing layer visibility' : 'Snap controls'}"><button class="utility-close" data-action="close-utility-panel" aria-label="Close panel">×</button><div class="utility-popover-body">${content}</div></div>`;
}

function renderCatToolbar() {
  if (mode !== 'cat') return '';
  const dimensionsVisible = getCatDimensionLayer(documentModel).visible;
  const hint = catTool === 'offset' ? catDraft?.sourceLineId ? 'Choose side · type distance if needed' : 'Choose a CAT line or arc'
    : catTool === 'extend' ? catDraft?.extendSourceId ? 'Choose intersection reference' : 'Choose line to extend'
      : catTool === 'trim' ? 'Choose line or arc to trim' : catTool === 'note' ? 'Choose arrow point' : catDraft ? 'Choose the second point' : 'Reference geometry';
  return `<div class="cat-toolbar" role="toolbar" aria-label="CAT construction tools"><div class="cat-toolbar-title"><strong>CAT CL</strong><small>${hint}</small></div><button class="button ${catTool === 'line' ? 'primary' : 'ghost'}" data-action="cat-tool-line" aria-pressed="${catTool === 'line'}"><span>╱</span> Line</button><button class="button ${catTool === 'offset' ? 'primary' : 'ghost'}" data-action="cat-tool-offset" aria-pressed="${catTool === 'offset'}">⫽ ${lastCatOffsetDistance ? `Repeat Offset · ${formatFeetInches(lastCatOffsetDistance)}` : 'Offset'}</button><button class="button ${catTool === 'measure' ? 'primary' : 'ghost'}" data-action="cat-tool-measure" aria-pressed="${catTool === 'measure'}"><span>↔</span> Tape</button><button class="button ${catTool === 'trim' ? 'primary' : 'ghost'}" data-action="cat-tool-trim" aria-pressed="${catTool === 'trim'}">⌫ Trim</button><button class="button ${catTool === 'extend' ? 'primary' : 'ghost'}" data-action="cat-tool-extend" aria-pressed="${catTool === 'extend'}">⇥ Extend</button><button class="button ${catTool === 'note' ? 'primary' : 'ghost'}" data-action="cat-tool-note" aria-pressed="${catTool === 'note'}">↗ Note</button><button class="button ${dimensionsVisible ? 'active-constraint' : 'ghost'}" data-action="toggle-cat-dimensions" aria-pressed="${dimensionsVisible}">${dimensionsVisible ? '◉' : '○'} CAT dimensions</button><button class="button ghost" data-action="close-cat-tool">Done</button></div>`;
}

function renderCatOperationPrompt() {
  if (mode !== 'cat' || catTool !== 'extend' || !catDraft?.extendSourceId) return '';
  const source = getCatLines(documentModel).find((line) => line.id === catDraft.extendSourceId);
  const kind = source && deriveCatLineGeometry(source).kind === 'arc' ? 'arc circumference' : 'line direction';
  return `<div class="cat-operation-prompt" role="status"><strong>Extend to line intersection</strong><span>First line locked · select the second CAT Line.</span><small>The first line extends along its ${kind}; the second line remains unchanged.</small></div>`;
}

function renderFramingToolbar() {
  if (mode !== 'framing') return '';
  const hint = framingTool === 'joist'
    ? !joistTargetBoundaryId ? 'Select the Deck Boundary to fill' : framingGesture ? 'Drag perpendicular · release to establish field' : 'Select any reference line and drag'
    : framingDraft ? 'Choose the far end' : framingTool === 'post' ? 'Tap beneath a Beam or Rim / Flush' : 'Tap each end of the run';
  return `<div class="cat-toolbar framing-toolbar" role="toolbar" aria-label="Framing tools"><div class="cat-toolbar-title"><strong>Framing</strong><small>${hint}</small></div><button class="button ${framingTool === 'joist' ? 'primary' : 'ghost'}" data-action="framing-tool-joist">Joist</button><button class="button ${framingTool === 'beam' ? 'primary' : 'ghost'}" data-action="framing-tool-beam">Beam</button><button class="button ${framingTool === 'post' ? 'primary' : 'ghost'}" data-action="framing-tool-post">Post / Footing</button><button class="button ghost" data-action="close-framing-tool">Done</button></div>`;
}

function renderVisibilityControls() {
  const dimensionsVisible = getDimensionLayer(documentModel).visible;
  const railingLayer = getRailingLayer(documentModel);
  const catConstructionLayer = getCatConstructionLayer(documentModel);
  const catDimensionLayer = getCatDimensionLayer(documentModel);
  const deckingLayer = getDeckingLayer(documentModel);
  const gridLayer = getGridLayer(documentModel);
  const framingLayer = getFramingLayer(documentModel);
  const row = (id, label, description, visible) => `<label class="layer-row"><span class="layer-grip">⋮⋮</span><span class="layer-eye">${visible ? '◉' : '○'}</span><span><strong>${label}</strong><small>${description}</small></span><input id="${id}" type="checkbox" ${visible ? 'checked' : ''}></label>`;
  return `<section class="inspector-section layer-panel"><div class="eyebrow">Drawing layers</div><h2>Visibility</h2><p class="section-copy">Hide model or annotation layers to reach construction lines underneath.</p>${row('decking-visible', 'Decking', 'Walkable surface fill and board pattern', deckingLayer.visible)}${row('railing-visible', 'Railing', 'Construction runs and posts', railingLayer.visible)}${row('framing-visible', 'Framing', 'Beams, posts, footings and framing objects', framingLayer.visible)}${row('joists-visible', 'Joists', 'Continuous runs and span warnings', framingLayer.joistsVisible)}${row('cat-construction-visible', 'CAT construction lines', 'Yellow reference geometry for future construction', catConstructionLayer.visible)}${row('cat-dimensions-visible', 'CAT dimensions', 'Secondary horizontal, vertical, and direct measurements', catDimensionLayer.visible)}${row('dimensions-visible', 'Dimensions', 'Drag labels · double-click to edit', dimensionsVisible)}${row('grid-visible', 'Construction grid', 'Visual guide · snap remains independent', gridLayer.visible)}</section>`;
}

function renderSnapControls() {
  const snapSettings = getSnapSettings(documentModel);
  return `<section class="inspector-section snap-panel"><div class="eyebrow">Precision</div><h2>Snap controls</h2><p class="section-copy">Inference guides align new geometry to nearby nodes without creating permanent constraints.</p><label class="snap-option"><input id="snap-edges" type="checkbox" ${snapSettings.edges ? 'checked' : ''}><span><strong>Edges & corners</strong><small>Connect endpoints to project geometry and CAT CL</small></span><kbd>E</kbd></label><label class="snap-option"><input id="snap-grid" type="checkbox" ${snapSettings.grid ? 'checked' : ''}><span><strong>Construction grid</strong><small>Place endpoints at field increments</small></span><kbd>G</kbd></label><label class="snap-option"><input id="snap-node-inference" type="checkbox" ${snapSettings.nodeInference ? 'checked' : ''}><span><strong>Node inference</strong><small>Horizontal and vertical references</small></span><kbd>N</kbd></label><label class="snap-option"><input id="snap-diagonal-inference" type="checkbox" ${snapSettings.diagonalInference ? 'checked' : ''} ${snapSettings.nodeInference ? '' : 'disabled'}><span><strong>Angled inference</strong><small>22.5° and 45° references from nearby nodes</small></span><kbd>22.5°</kbd></label><div class="field-grid"><div class="field full"><label for="grid-spacing">Grid snap increment</label><select id="grid-spacing"><option value="auto" ${gridSetting === 'auto' ? 'selected' : ''}>Adaptive view · ½″ precision</option>${[.5, 1, 2, 6, 12, 24].map((value) => `<option value="${value}" ${String(value) === String(gridSetting) ? 'selected' : ''}>${value} inch${value === 1 ? '' : 'es'}</option>`).join('')}</select></div></div><div class="action-stack"><button class="button" data-action="fit-project">Fit project to view</button></div></section>`;
}

function renderInspector(current, validation) {
  if (!current) return `
    <section class="inspector-section empty-panel"><div class="eyebrow">First construction object</div><div class="empty-symbol">◇</div><h2>Define the deck surface</h2><p class="section-copy">Start from field dimensions or draw a custom outline. The finished boundary becomes part of the project model.</p></section>
    <section class="inspector-section"><div class="eyebrow">Fast start</div><h2>Rectangle deck</h2><p class="section-copy">Enter the outside dimensions of the walkable surface.</p><div class="field-grid"><div class="field"><label for="width">Width (ft)</label><input id="width" type="number" min="1" step="0.5" value="16"></div><div class="field"><label for="depth">Depth (ft)</label><input id="depth" type="number" min="1" step="0.5" value="12"></div></div><div class="action-stack"><button class="button primary" data-action="create-rectangle">Create deck boundary</button><button class="button" data-mode="draw">Draw a custom outline</button></div><div class="hint-card">Measure the outside edge of the finished walking surface. Structural framing will connect to this boundary in future tools.</div></section>`;
  const selectedEdge = selected.kind === 'edge' ? current.edges.find((edge) => edge.id === selected.id) : null;
  const selectedVertex = selected.kind === 'vertex' ? current.vertices.find((vertex) => vertex.id === selected.id) : null;
  const selectedStair = selected.kind === 'stair' ? documentModel.objects.find((object) => object.type === 'stair' && object.id === selected.id) : null;
  const selectedStairEdge = selected.kind === 'stair-edge' ? findStairInterfaceByEdgeId(selected.id) : null;
  const selectedRailing = selected.kind === 'railing' ? findResolvedRailingGeometry(selected.id) ?? findRailingGeometry(selected.id) : null;
  const firstIssue = validation.issues[0];
  return `
    ${validation.valid ? '' : `<section class="inspector-section"><div class="validation error"><span class="validation-dot"></span><span>${escapeHtml(firstIssue?.message ?? 'Boundary needs attention.')}</span></div></section>`}
    ${selectedEdge ? renderEdgeInspector(current, selectedEdge) : ''}
    ${stairDraft && selectedEdge ? renderStairInspector(current, selectedEdge) : ''}
    ${selectedStair ? renderStairObjectInspector(selectedStair) : ''}
    ${selectedStairEdge ? renderStairInterfaceInspector(current, selectedStairEdge.stair, selectedStairEdge.edge) : ''}
    ${selectedRailing ? renderRailingInspector(selectedRailing) : ''}
    ${selectedVertex ? `<section class="inspector-section"><div class="eyebrow">Selected corner</div><h2>Geometry corner</h2><p class="section-copy">Drag freely, or place this corner over a neighboring corner to merge them and remove the redundant edge.</p><div class="vertex-guidance"><span class="merge-symbol"></span><span>Neighboring corners glow when a valid merge is available.</span></div><div class="action-stack"><button class="button danger" data-action="delete-vertex" ${current.vertices.length <= 3 ? 'disabled' : ''}>Remove corner</button></div></section>` : ''}`;
}

function renderRailingInspector(geometry) {
  const project = analyzeRailingGeometries(getAllRailingGeometries(), documentModel.railingCornerSettings);
  return `<section class="inspector-section railing-panel"><div class="object-status"><div><div class="eyebrow">Railing construction object</div><h2>${escapeHtml(geometry.railing.name)}</h2></div><span class="object-badge established">Snap anchored</span></div><p class="section-copy">This run may cross inside or outside the deck. Each endpoint retains its edge, corner, or grid snap reference.</p><div class="metric-grid"><div class="metric"><div class="metric-label">Run length</div><div class="metric-value">${formatFeetInches(geometry.sourceLength ?? geometry.length)}</div></div><div class="metric"><div class="metric-label">Sections</div><div class="metric-value">${geometry.sectionCount}</div></div><div class="metric"><div class="metric-label">Clear span</div><div class="metric-value">${formatFeetInches(geometry.clearSpan)}</div></div><div class="metric"><div class="metric-label">Run posts</div><div class="metric-value">${geometry.postCount}</div></div></div><div class="validation"><span class="validation-dot"></span><span>Post spacing regenerates equally between the active corner posts and removes an intermediate post when the 6 ft rule still permits it.</span></div><div class="hint-card">Project railing: ${formatFeetInches(project.totalLength)} · ${project.sectionCount} sections · ${project.estimatedPostCount} visible posts.</div><div class="action-stack"><button class="button danger" data-action="remove-railing">Remove railing run</button></div></section>`;
}

function renderStairInterfaceInspector(current, stair, edge) {
  const byId = getStairVertexMap(current, stair);
  const start = byId.get(edge.startVertexId);
  const end = byId.get(edge.endVertexId);
  const length = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : stair.dimensions.width;
  const properties = normalizeBoundaryEdge(edge).properties;
  const nodeControlled = stair.dimensions.snappedStart || stair.dimensions.snappedEnd;
  return `<section class="inspector-section edge-inspector stair-interface-panel"><div class="object-status"><div><div class="eyebrow">Deck–Stair interface</div><h2>${formatFeetInches(length)}</h2></div><span class="object-badge established">${nodeControlled ? 'Node snapped' : 'Selectable edge'}</span></div><p class="section-copy">${nodeControlled ? 'The stair side is attached to an adjacent construction node. Move that shared node to change the opening while preserving the snap.' : 'This is the construction line where the staircase meets the deck. Assign finishes here without creating overlapping geometry.'}</p><div class="field-grid"><div class="field full"><label for="stair-interface-width">Exact opening width</label><div class="compound-field"><input id="stair-interface-width" value="${formatFeetInches(length)}" ${nodeControlled ? 'disabled' : ''}><button class="button" data-action="apply-stair-width" ${nodeControlled ? 'disabled' : ''}>Apply</button></div></div></div><div class="property-list"><label><input type="checkbox" data-edge-property="fascia" ${properties.finishes.fascia ? 'checked' : ''}><span><strong>Fascia</strong><small>Finish board at stair interface</small></span></label><label><input type="checkbox" data-edge-property="pictureFrame" ${properties.finishes.pictureFrame ? 'checked' : ''}><span><strong>Picture frame</strong><small>Decking board along opening</small></span></label><label><input type="checkbox" data-edge-property="demolition" ${properties.existingConditions.demolition ? 'checked' : ''}><span><strong>Demolition</strong><small>Existing interface to remove</small></span></label></div><div class="continuity-note">Owned by ${escapeHtml(stair.name)}</div></section>`;
}

function findStairInterfaceByEdgeId(edgeId) {
  for (const stair of documentModel.objects.filter((object) => object.type === 'stair')) {
    const edge = getStairInterfaceEdge(stair);
    if (edge.id === edgeId) return { stair, edge };
  }
  return null;
}

function stairSideId(stair, side) {
  return `${stair.id}:side:${side}`;
}

function findStairSide(referenceId) {
  for (const stair of documentModel.objects.filter((object) => object.type === 'stair')) {
    for (const side of ['start', 'end']) if (stairSideId(stair, side) === referenceId) return { stair, side };
  }
  return null;
}

function resolveRailingHostByEdgeId(edgeId, edgeKind = null) {
  const current = boundaryForReference(edgeId) ?? boundary();
  if (!current) return null;
  if (edgeKind !== 'stair-interface-edge') {
    const edge = current.edges.find((entry) => entry.id === edgeId);
    if (edge) {
      const byId = new Map(current.vertices.map((vertex) => [vertex.id, vertex]));
      return {
        host: { boundaryId: current.id, edgeId: edge.id, edgeKind: 'boundary-edge' },
        edge,
        start: byId.get(edge.startVertexId),
        end: byId.get(edge.endVertexId),
      };
    }
  }
  const reference = findStairInterfaceByEdgeId(edgeId);
  if (!reference) return null;
  const hostBoundary = boundaryById(reference.stair.host.boundaryId) ?? current;
  const byId = getStairVertexMap(hostBoundary, reference.stair);
  return {
    host: { boundaryId: current.id, edgeId: reference.edge.id, edgeKind: 'stair-interface-edge', ownerId: reference.stair.id },
    edge: reference.edge,
    stair: reference.stair,
    start: byId.get(reference.edge.startVertexId),
    end: byId.get(reference.edge.endVertexId),
  };
}

function findRailingGeometry(railingId) {
  const railing = documentModel.objects.find((object) => object.type === 'railing-run' && object.id === railingId);
  if (!railing) return null;
  if (railing.anchors?.start && railing.anchors?.end) {
    const start = resolveRailingAnchor(railing.anchors.start);
    const end = resolveRailingAnchor(railing.anchors.end);
    return start && end ? deriveRailingLineGeometry(railing, start, end) : null;
  }
  const reference = resolveRailingHostByEdgeId(railing.host.edgeId, railing.host.edgeKind);
  return reference?.start && reference?.end ? deriveRailingGeometry(railing, reference.start, reference.end) : null;
}

function resolveRailingAnchor(anchor) {
  const current = boundaryById(anchor.boundaryId) ?? boundaryForReference(anchor.vertexId ?? anchor.edgeId) ?? boundary();
  if (!current) return anchor.point ?? null;
  if (anchor.snapType === 'vertex') return current.vertices.find((vertex) => vertex.id === anchor.vertexId) ?? anchor.point;
  if (anchor.snapType === 'edge') {
    const reference = resolveRailingHostByEdgeId(anchor.edgeId, anchor.edgeKind);
    if (reference?.start && reference?.end) {
      return {
        x: reference.start.x + (reference.end.x - reference.start.x) * anchor.t,
        y: reference.start.y + (reference.end.y - reference.start.y) * anchor.t,
      };
    }
  }
  return anchor.point ?? null;
}

function getAllRailingGeometries() {
  return documentModel.objects.filter((object) => object.type === 'railing-run').map((railing) => findRailingGeometry(railing.id)).filter(Boolean);
}

function getRailingPostLayout() {
  return deriveRailingPostLayout(getAllRailingGeometries(), documentModel.railingCornerSettings);
}

function findRailingPost(postId) {
  return getRailingPostLayout().posts.find((post) => post.id === postId) ?? null;
}

function findResolvedRailingGeometry(railingId) {
  return getRailingPostLayout().geometries.find((geometry) => geometry.railing.id === railingId) ?? null;
}

function areaDimensionId(current = boundary()) {
  return current ? `${current.id}:area` : null;
}

function stairDimensionId(stair) {
  return `${stair.id}:label`;
}

function findStairByDimensionId(referenceId) {
  return documentModel.objects.find((object) => object.type === 'stair' && stairDimensionId(object) === referenceId) ?? null;
}

function levelDownDimensionId(levelDown) {
  return `${levelDown.id}:drop`;
}

function findLevelDownByDimensionId(referenceId) {
  return documentModel.objects.find((object) => object.type === 'level-down' && levelDownDimensionId(object) === referenceId) ?? null;
}

function getLevelDownDepth(levelDown, current = boundary()) {
  return deriveLevelDownDepth(levelDown, documentModel.objects.filter((object) => object.type === 'level-down' && object.host.boundaryId === current?.id), current);
}

function findLevelDownSegment(segmentId) {
  for (const levelDown of documentModel.objects.filter((object) => object.type === 'level-down')) {
    const index = levelDown.segments.findIndex((segment) => segment.id === segmentId);
    if (index < 0) continue;
    const start = levelDown.vertices[index];
    const end = levelDown.vertices[index + 1];
    return { levelDown, segment: levelDown.segments[index], index, start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  }
  return null;
}

function resolveBoardingReference({ edgeId, stairEdgeId, stairSideReferenceId, levelDownSegmentId, railingId }) {
  if (edgeId || stairEdgeId) {
    if (edgeId) {
      const owner = boundaryForReference(edgeId) ?? boundary();
      const arc = owner ? getBoundaryArc(owner, edgeId) : null;
      if (arc) return { arc, start: arc.start, end: arc.end, reference: { kind: 'boundary-arc', id: arc.id, ownerId: owner.id } };
    }
    const reference = resolveRailingHostByEdgeId(edgeId ?? stairEdgeId, stairEdgeId ? 'stair-interface-edge' : null);
    if (reference?.start && reference?.end) return {
      start: reference.start,
      end: reference.end,
      reference: { kind: reference.stair ? 'stair-interface' : 'boundary-edge', id: reference.edge.id, ownerId: reference.stair?.id ?? reference.host.boundaryId },
    };
  }
  if (stairSideReferenceId) {
    const reference = findStairSide(stairSideReferenceId);
    const current = reference ? boundaryById(reference.stair.host.boundaryId) : null;
    if (reference && current) {
      const byId = getStairVertexMap(current, reference.stair);
      const start = byId.get(reference.side === 'start' ? reference.stair.anchors.openingStartVertexId : reference.stair.anchors.openingEndVertexId);
      const end = byId.get(reference.side === 'start' ? reference.stair.anchors.outerStartVertexId : reference.stair.anchors.outerEndVertexId);
      if (start && end) return { start, end, reference: { kind: 'stair-side', id: stairSideReferenceId, ownerId: reference.stair.id } };
    }
  }
  if (levelDownSegmentId) {
    const reference = findLevelDownSegment(levelDownSegmentId);
    if (reference) return { start: reference.start, end: reference.end, reference: { kind: 'level-down-segment', id: reference.segment.id, ownerId: reference.levelDown.id } };
  }
  if (railingId) {
    const geometry = findRailingGeometry(railingId);
    if (geometry) return { start: geometry.start, end: geometry.end, reference: { kind: 'railing-run', id: railingId, ownerId: railingId } };
  }
  return null;
}

function selectedLevelDown() {
  if (selected.kind === 'level-down') return findLevelDownSegment(selected.id)?.levelDown ?? null;
  if (selected.kind === 'dimension') return findLevelDownByDimensionId(selected.id);
  return null;
}

function resolveDimensionReference(referenceId) {
  const catRegion = deriveCatBoundaries(documentModel).find((region) => region.id === referenceId);
  if (catRegion) return { kind: 'cat-area', region: catRegion, label: `${formatSquareFeet(catRegion.areaSquareInches)} CAT area` };
  const current = boundaryForReference(referenceId) ?? boundary();
  if (current && referenceId === areaDimensionId(current)) return { kind: 'area', boundary: current, label: `${formatSquareFeet(current.computed.areaSquareInches)} deck area` };
  const stairLabel = findStairByDimensionId(referenceId);
  if (stairLabel) return { kind: 'stair', stair: stairLabel, boundary: boundaryById(stairLabel.host.boundaryId), label: stairLabel.name };
  const levelDown = findLevelDownByDimensionId(referenceId);
  if (current && levelDown) return { kind: 'level-down-area', levelDown, region: deriveLevelDownRegion(levelDown, current), label: `${formatInches(getLevelDownDepth(levelDown, current))} below main deck` };
  const railingGeometry = findRailingGeometry(referenceId);
  if (railingGeometry) return { kind: 'railing', railing: railingGeometry.railing, geometry: railingGeometry, label: `${formatFeetInches(railingGeometry.length)} railing run` };
  const edgeIndex = current?.edges.findIndex((edge) => edge.id === referenceId) ?? -1;
  if (edgeIndex >= 0) {
    const edge = current.edges[edgeIndex];
    const start = current.vertices[edgeIndex];
    const end = current.vertices[(edgeIndex + 1) % current.vertices.length];
    const stair = edge.properties?.attachments?.stairId
      ? documentModel.objects.find((object) => object.type === 'stair' && object.id === edge.properties.attachments.stairId)
      : null;
    return { kind: 'boundary-edge', edge, stair, label: `${formatFeetInches(Math.hypot(end.x - start.x, end.y - start.y))} dimension` };
  }
  const interfaceReference = findStairInterfaceByEdgeId(referenceId);
  if (!interfaceReference || !current) return null;
  const byId = getStairVertexMap(current, interfaceReference.stair);
  const start = byId.get(interfaceReference.edge.startVertexId);
  const end = byId.get(interfaceReference.edge.endVertexId);
  return { kind: 'stair-interface', ...interfaceReference, label: `${formatFeetInches(Math.hypot(end.x - start.x, end.y - start.y))} stair opening` };
}

function getDimensionObjectAnchor(referenceId) {
  const reference = resolveDimensionReference(referenceId);
  if (reference?.kind === 'cat-area') return reference.region.centroid;
  const current = reference?.boundary ?? boundaryForReference(referenceId) ?? boundary();
  if (!reference || !current) return null;
  if (reference.kind === 'area') return getBoundaryCentroid(current);
  if (reference.kind === 'level-down-area') return reference.region?.centroid ?? null;
  if (reference.kind === 'railing') return { x: (reference.geometry.start.x + reference.geometry.end.x) / 2, y: (reference.geometry.start.y + reference.geometry.end.y) / 2 };
  if (reference.kind === 'stair') {
    const byId = getStairVertexMap(current, reference.stair);
    const points = Object.values(reference.stair.anchors).map((id) => byId.get(id)).filter(Boolean);
    return points.length ? { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length } : null;
  }
  if (reference.kind === 'stair-interface') {
    const byId = getStairVertexMap(current, reference.stair);
    const start = byId.get(reference.edge.startVertexId);
    const end = byId.get(reference.edge.endVertexId);
    return start && end ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } : null;
  }
  const edgeIndex = current.edges.findIndex((edge) => edge.id === reference.edge?.id);
  if (edgeIndex < 0) return null;
  const start = current.vertices[edgeIndex];
  const end = current.vertices[(edgeIndex + 1) % current.vertices.length];
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function renderStairObjectInspector(stair) {
  const riserCount = stair.dimensions.riserCount ?? stair.dimensions.stepCount;
  const treadCount = stair.dimensions.treadCount ?? Math.max(1, riserCount - 1);
  return `<section class="inspector-section stair-panel"><div class="object-status"><div><div class="eyebrow">Stair construction object</div><h2>${escapeHtml(stair.name)}</h2></div><span class="object-badge ${stair.lifecycle?.needsReview ? 'review' : 'established'}">${stair.lifecycle?.needsReview ? 'Needs review' : stair.destination ? 'Deck connected' : 'Attached'}</span></div><p class="section-copy">${stair.destination ? 'This staircase connects its upper Deck Boundary to a referenced lower deck landing.' : 'Generated from the authoritative Deck Boundary. The deck surface is the upper landing, so the final transition from the last tread counts as a riser.'}</p><div class="metric-grid"><div class="metric"><div class="metric-label">Total rise</div><div class="metric-value">${formatFeetInches(stair.dimensions.totalRise)}</div></div><div class="metric"><div class="metric-label">Total run</div><div class="metric-value">${formatFeetInches(stair.dimensions.totalRun)}</div></div><div class="metric"><div class="metric-label">Risers</div><div class="metric-value">${riserCount} × ${formatFeetInches(stair.dimensions.riserHeight)}</div></div><div class="metric"><div class="metric-label">Treads</div><div class="metric-value">${treadCount} × ${formatFeetInches(stair.dimensions.treadDepth)}</div></div></div><div class="validation ${stair.lifecycle?.needsReview ? 'error' : ''}"><span class="validation-dot"></span><span>${stair.lifecycle?.needsReview ? 'The destination deck must remain below the stair host. Reconnect this staircase after changing levels.' : 'Each riser is 7.5″ or less and each tread is 11″ or less.'}</span></div></section>`;
}

function renderEdgeInspector(current, edge) {
  const normalized = normalizeBoundaryEdge(edge);
  const index = current.edges.findIndex((entry) => entry.id === edge.id);
  const start = current.vertices[index];
  const end = current.vertices[(index + 1) % current.vertices.length];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const properties = normalized.properties;
  const orientation = getEdgeOrientationConstraint(current, edge.id);
  const locked = isEdgeLocked(current, edge.id);
  return `<section class="inspector-section edge-inspector"><div class="object-status"><div><div class="eyebrow">Construction edge</div><h2>${formatFeetInches(length)}</h2></div><span class="object-badge established">Independent</span></div><p class="section-copy">Drag the edge to move it, or refine it with exact construction dimensions.</p><div class="field-grid"><div class="field full"><label for="edge-length">Exact edge length</label><div class="compound-field"><input id="edge-length" value="${formatFeetInches(length)}"><button class="button" data-action="apply-edge-length">Apply</button></div></div><div class="field full"><label for="edge-offset">Move perpendicular</label><div class="compound-field"><input id="edge-offset" placeholder="6 in"><button class="button" data-action="apply-edge-offset">Move</button></div></div></div><div class="constraint-row constraint-row-3" role="group" aria-label="Edge orientation"><button class="button ${orientation?.type === 'horizontal' ? 'active-constraint' : ''}" data-action="constraint-horizontal" ${locked ? 'disabled' : ''}>${orientation?.type === 'horizontal' ? '✓ ' : ''}Horizontal</button><button class="button ${orientation?.type === 'vertical' ? 'active-constraint' : ''}" data-action="constraint-vertical" ${locked ? 'disabled' : ''}>${orientation?.type === 'vertical' ? '✓ ' : ''}Vertical</button><button class="button ${orientation?.type === 'fixed-angle' ? 'active-constraint' : ''}" data-action="constraint-lock-angle" ${locked ? 'disabled' : ''}>${orientation?.type === 'fixed-angle' ? '✓ ' : ''}Lock angle</button></div><div class="constraint-status ${orientation ? 'active' : ''}"><span>${orientation ? '●' : '○'}</span>${locked ? 'Full edge lock active' : describeOrientationConstraint(orientation)}</div><div class="property-list"><label><input type="checkbox" data-edge-property="fascia" ${properties.finishes.fascia ? 'checked' : ''}><span><strong>Fascia</strong><small>Exterior finish board</small></span></label><label><input type="checkbox" data-edge-property="pictureFrame" ${properties.finishes.pictureFrame ? 'checked' : ''}><span><strong>Picture frame</strong><small>Decking board along edge</small></span></label><label><input type="checkbox" data-edge-property="demolition" ${properties.existingConditions.demolition ? 'checked' : ''}><span><strong>Demolition</strong><small>Existing edge to remove</small></span></label></div><div class="field-grid"><div class="field full"><label for="edge-role">Construction relationship</label><select id="edge-role"><option value="open" ${edge.role === 'open' ? 'selected' : ''}>Unassigned</option><option value="house" ${edge.role === 'house' ? 'selected' : ''}>House attachment</option><option value="free-edge" ${edge.role === 'free-edge' ? 'selected' : ''}>Open deck edge</option></select></div><div class="field full"><label for="edge-railing">Railing intent</label><select id="edge-railing"><option value="unassigned" ${properties.safety.railing === 'unassigned' ? 'selected' : ''}>Unassigned</option><option value="required" ${properties.safety.railing === 'required' ? 'selected' : ''}>Railing required</option><option value="existing" ${properties.safety.railing === 'existing' ? 'selected' : ''}>Existing railing</option></select></div></div><div class="action-stack"><button class="button" data-action="insert-midpoint">Insert corner at midpoint</button><button class="button primary" data-action="start-stair">Attach staircase</button></div></section>`;
}

function describeOrientationConstraint(constraint) {
  if (!constraint) return 'Angle is free';
  if (constraint.type === 'horizontal') return 'Active constraint: Horizontal';
  if (constraint.type === 'vertical') return 'Active constraint: Vertical';
  let degrees = constraint.angleRadians * 180 / Math.PI;
  degrees = ((degrees % 180) + 180) % 180;
  if (Math.abs(degrees - 180) < .05) degrees = 0;
  return `Active constraint: Angle locked · ${degrees.toFixed(1)}°`;
}

function renderStairInspector(current, edge) {
  return `<section class="inspector-section stair-panel"><div class="eyebrow">Live stair placement</div><h2>Press and drag outward</h2><p class="section-copy">The drag controls total rise first. CME chooses equal risers, then snaps the run to equal construction treads. A lower deck connects only when the complete landing line fits inside its surface.</p><div class="stair-limit-list"><span><strong>5″–7.5″</strong> equal risers</span><span><strong>10″–11″</strong> equal treads</span><span><strong>Deck</strong> is the upper landing</span></div><div class="action-stack"><button class="button" data-action="cancel-stair">Cancel stair tool</button></div></section>`;
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
  svg.append(defs, svgElement('rect', { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height, fill: getGridLayer(documentModel).visible ? 'url(#majorGrid)' : '#0d1114' }));
  svg.append(svgElement('line', { x1: viewport.x, y1: '0', x2: viewport.x + viewport.width, y2: '0', class: 'axis-line' }), svgElement('line', { x1: '0', y1: viewport.y, x2: '0', y2: viewport.y + viewport.height, class: 'axis-line' }));
  if (current) {
    boundaries().forEach((deck) => {
      const visibleBoundary = archDraft?.id === deck.id ? archDraft : chamferDraft?.boundary?.id === deck.id ? chamferDraft.boundary : deck;
      if (isDeckBoundaryVisible(visibleBoundary)) renderBoundarySvg(svg, visibleBoundary, validateDeckBoundary(visibleBoundary));
      renderLevelDownGraphics(svg, visibleBoundary);
    });
    // Construction objects must remain above every deck surface. Rendering a
    // lower deck after its host stair would otherwise cover the completed stair
    // even though the object was successfully stored in the project model.
    boundaries().forEach((deck) => {
      const visibleBoundary = archDraft?.id === deck.id ? archDraft : chamferDraft?.boundary?.id === deck.id ? chamferDraft.boundary : deck;
      renderStairGraphics(svg, visibleBoundary);
    });
    renderStairPreview(svg, current);
    renderRailingGraphics(svg);
    if (getDimensionLayer(documentModel).visible) {
      boundaries().forEach((deck) => {
        const visibleBoundary = archDraft?.id === deck.id ? archDraft : chamferDraft?.boundary?.id === deck.id ? chamferDraft.boundary : deck;
        renderBoundaryDimensions(svg, visibleBoundary);
        renderLevelDownDimensions(svg, visibleBoundary);
        renderStairDimensions(svg, visibleBoundary);
      });
      if (chamferDraft) renderChamferDimension(svg, chamferDraft);
    }
  }
  renderFramingGraphics(svg);
  renderCatGraphics(svg);
  if (draft.length) renderDraft(svg);
}

function renderFramingGraphics(svg) {
  const layer = getFramingLayer(documentModel);
  if (!layer.visible) return;
  const selectedClass = (id) => selected.kind === 'framing' && selected.id === id ? ' selected' : '';
  getBeams(documentModel).forEach((beam) => {
    svg.append(svgElement('line', { x1: beam.start.x, y1: beam.start.y, x2: beam.end.x, y2: beam.end.y, class: `framing-beam${selectedClass(beam.id)}`, 'data-framing-id': beam.id }));
    svg.append(svgElement('line', { x1: beam.start.x, y1: beam.start.y, x2: beam.end.x, y2: beam.end.y, class: 'framing-hit', 'data-framing-id': beam.id }));
    const geometry = deriveBeamGeometry(beam, layer.settings, deriveBeamLoad(documentModel, beam));
    if (geometry) renderBeamSupports(svg, geometry, false);
    if (selected.kind === 'framing' && selected.id === beam.id) {
      const markerSize = Math.max(3.5, viewport.width / 135);
      const hitRadius = viewport.width / Math.max(svg.clientWidth || 1000, 1) * 18;
      ['start', 'end'].forEach((endpoint) => {
        const point = beam[endpoint];
        svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: hitRadius, class: 'framing-node-hit', 'data-framing-id': beam.id, 'data-framing-node': endpoint }));
        svg.append(svgElement('rect', { x: point.x - markerSize / 2, y: point.y - markerSize / 2, width: markerSize, height: markerSize, rx: markerSize * .15, class: 'framing-node', 'data-framing-id': beam.id, 'data-framing-node': endpoint }));
      });
    }
  });
  if (layer.joistsVisible) deriveJoistBlockingRows(documentModel).forEach((row) => row.segments.forEach((segment) => {
    const selectedRow = selected.kind === 'blocking' && selected.id === row.id;
    svg.append(svgElement('line', { x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y, class: `joist-blocking${selectedRow ? ' selected' : ''}`, 'data-blocking-row-id': row.id }));
    svg.append(svgElement('line', { x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y, class: 'joist-blocking-hit', 'data-blocking-row-id': row.id }));
  }));
  if (layer.joistsVisible) getJoists(documentModel).forEach((joist) => {
    const analysis = analyzeJoist(joist);
    const needsReview = analysis.stock?.needsReview || analysis.spanValidation.valid !== true;
    svg.append(svgElement('line', { x1: joist.start.x, y1: joist.start.y, x2: joist.end.x, y2: joist.end.y, class: `framing-joist continuous${needsReview && !joist.reviewIgnored ? ' review' : ''}${selectedClass(joist.id)}`, 'data-framing-id': joist.id }));
    svg.append(svgElement('line', { x1: joist.start.x, y1: joist.start.y, x2: joist.end.x, y2: joist.end.y, class: 'framing-hit', 'data-framing-id': joist.id }));
    if (needsReview) {
      const x = (joist.start.x + joist.end.x) / 2;
      const y = (joist.start.y + joist.end.y) / 2;
      const size = Math.max(5, viewport.width / 120);
      svg.append(svgElement('path', { d: `M ${x} ${y - size} L ${x + size * .9} ${y + size * .7} L ${x - size * .9} ${y + size * .7} Z`, class: `joist-warning${joist.reviewIgnored ? ' acknowledged' : ''}`, 'data-framing-id': joist.id }));
      const mark = svgElement('text', { x, y: y + size * .42, class: 'joist-warning-mark', 'data-framing-id': joist.id });
      mark.textContent = '!';
      svg.append(mark);
    }
  });
  if (framingDraft?.kind === 'joist-field') {
    framingDraft.field.joists.forEach((joist) => {
      svg.append(svgElement('line', { x1: joist.start.x, y1: joist.start.y, x2: joist.end.x, y2: joist.end.y, class: `framing-joist preview${!joist.supported || joist.stock.needsReview || joist.layout?.spanValidation?.valid !== true ? ' invalid' : ''}` }));
    });
  }
  getPosts(documentModel).forEach((post) => {
    const footingSize = Number(post.footing?.sizeInches) || layer.settings.footingSizeInches || DEFAULT_MANUAL_FOOTING_SIZE_INCHES;
    svg.append(svgElement('rect', { x: post.at.x - footingSize / 2, y: post.at.y - footingSize / 2, width: footingSize, height: footingSize, class: 'framing-footing' }));
    svg.append(svgElement('rect', { x: post.at.x - 1.75, y: post.at.y - 1.75, width: 3.5, height: 3.5, class: `framing-post${selectedClass(post.id)}`, 'data-framing-id': post.id }));
  });
  getPillars(documentModel).forEach((pillar) => {
    const half = (Number(pillar.dimensions?.sizeInches) || 6) / 2;
    svg.append(svgElement('rect', { x: pillar.at.x - half, y: pillar.at.y - half, width: half * 2, height: half * 2, class: `framing-pillar${selectedClass(pillar.id)}`, 'data-framing-id': pillar.id }));
  });
  if (framingDraft?.start && pointerWorld) {
    svg.append(svgElement('line', { x1: framingDraft.start.x, y1: framingDraft.start.y, x2: pointerWorld.x, y2: pointerWorld.y, class: 'framing-draft' }));
    if (framingTool === 'beam') {
      const preview = deriveBeamGeometry({ id: 'preview', start: framingDraft.start, end: pointerWorld }, layer.settings);
      if (preview) renderBeamSupports(svg, preview, true);
    }
  }
}

function renderBeamSupports(svg, geometry, preview) {
  geometry.posts.forEach((post) => {
    svg.append(svgElement('rect', { x: post.x - geometry.footingSizeInches / 2, y: post.y - geometry.footingSizeInches / 2, width: geometry.footingSizeInches, height: geometry.footingSizeInches, class: `framing-footing${preview ? ' preview' : ''}` }));
    svg.append(svgElement('rect', { x: post.x - 2.25, y: post.y - 2.25, width: 4.5, height: 4.5, rx: .5, class: `framing-derived-post${preview ? ' preview' : ''}` }));
  });
}

function renderCatGraphics(svg) {
  if (getCatConstructionLayer(documentModel).visible) {
    deriveCatBoundaries(documentModel).forEach((region) => {
      const selectedClass = selected.kind === 'dimension' && selected.id === region.id ? 'selected' : '';
      if (isCatBoundaryVisible(documentModel, region)) svg.append(svgElement('polygon', { points: region.vertices.map((point) => `${point.x},${point.y}`).join(' '), class: `cat-boundary-fill ${selectedClass}` }));
      renderCatAreaLabel(svg, region, selectedClass);
    });
    getCatLines(documentModel).filter(isCatLineVisible).forEach((line) => {
      const visibleLine = catArchDraft?.id === line.id ? catArchDraft : line;
      const geometry = deriveCatLineGeometry(visibleLine);
      const points = geometry.points.map((point) => `${point.x},${point.y}`).join(' ');
      const selectedClass = selected.kind === 'cat' && selected.id === line.id ? 'selected' : '';
      svg.append(svgElement('polyline', { points, class: `cat-line ${selectedClass}` }));
      svg.append(svgElement('polyline', { points, class: 'cat-line-hit', 'data-cat-object-id': line.id }));
      visibleLine.vertices.forEach((point) => svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: Math.max(1.7, viewport.width / 360), class: `cat-node ${selectedClass}` })));
      if (geometry.kind === 'arc' && (selected.id === line.id || catArchMode?.lineId === line.id)) renderCatArchDimensions(svg, visibleLine, geometry);
    });
  }
  if (getCatDimensionLayer(documentModel).visible) getCatMeasurements(documentModel).forEach((measurement) => renderCatMeasurement(svg, measurement, false));
  if (getCatDimensionLayer(documentModel).visible) getCatNotes(documentModel).forEach((note) => renderCatNote(svg, note));
  if (mode === 'cat' && catTool === 'offset' && catDraft?.sourceLineId && catPointer) {
    const source = getCatLines(documentModel).find((line) => line.id === catDraft.sourceLineId);
    if (source) {
      try { renderCatOffsetPreview(svg, source); } catch {}
    }
  } else if (mode === 'cat' && catDraft?.start && catPointer) {
    if (catSnapState.guides.includes('vertical')) svg.append(svgElement('line', { x1: catPointer.x, y1: viewport.y, x2: catPointer.x, y2: viewport.y + viewport.height, class: 'cat-guide-line' }));
    if (catSnapState.guides.includes('horizontal')) svg.append(svgElement('line', { x1: viewport.x, y1: catPointer.y, x2: viewport.x + viewport.width, y2: catPointer.y, class: 'cat-guide-line' }));
    if (catSnapState.inference) renderNodeInferenceGuide(svg, catSnapState.inference, catPointer, Math.max(2.8, viewport.width / 150));
    if (catTool === 'measure') renderCatMeasurement(svg, { id: 'cat-preview', start: catDraft.start, end: catPointer }, true);
    else {
      svg.append(svgElement('line', { x1: catDraft.start.x, y1: catDraft.start.y, x2: catPointer.x, y2: catPointer.y, class: 'cat-line preview' }));
      svg.append(svgElement('circle', { cx: catPointer.x, cy: catPointer.y, r: Math.max(2.2, viewport.width / 280), class: 'cat-snap-marker' }));
    }
  }
}

function renderCatOffsetPreview(svg, source) {
  const typed = numericBuffer ? parseConstructionLength(numericBuffer) : null;
  const exact = typed > 0 ? typed : lastCatOffsetDistance;
  const preview = offsetCatLine(source, catPointer, { ...(exact ? { distanceInches: exact } : {}) }, () => 'cat-offset-preview');
  const geometry = deriveCatLineGeometry(preview);
  svg.append(svgElement('polyline', { points: geometry.points.map((point) => `${point.x},${point.y}`).join(' '), class: 'cat-line preview' }));
  const sourceGeometry = deriveCatLineGeometry(source);
  let start; let end;
  if (sourceGeometry.kind === 'arc') {
    const dx = catPointer.x - sourceGeometry.center.x; const dy = catPointer.y - sourceGeometry.center.y; const magnitude = Math.hypot(dx, dy) || 1;
    start = { x: sourceGeometry.center.x + dx / magnitude * sourceGeometry.radius, y: sourceGeometry.center.y + dy / magnitude * sourceGeometry.radius };
    end = { x: sourceGeometry.center.x + dx / magnitude * geometry.radius, y: sourceGeometry.center.y + dy / magnitude * geometry.radius };
  } else {
    start = { x: (source.vertices[0].x + source.vertices[1].x) / 2, y: (source.vertices[0].y + source.vertices[1].y) / 2 };
    end = { x: (preview.vertices[0].x + preview.vertices[1].x) / 2, y: (preview.vertices[0].y + preview.vertices[1].y) / 2 };
  }
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'cat-offset-dimension' }));
  renderCatMeasurementLabel(svg, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, `OFFSET ${formatFeetInches(Math.abs(Number(preview.metadata.offset.distanceInches)))}`, 'cat-offset-preview', 'preview');
}

function renderCatAreaLabel(svg, region, selectedClass) {
  if (!getCatDimensionLayer(documentModel).visible || !isDimensionReferenceVisible(documentModel, region.id)) return;
  const label = `CAT AREA · ${formatSquareFeet(region.areaSquareInches)}`;
  const width = Math.max(58, label.length * 4.1);
  const offset = getDimensionOffset(documentModel, region.id);
  const leaderOffset = getDimensionLeaderOffset(documentModel, region.id);
  const labelPoint = { x: region.centroid.x + offset.x, y: region.centroid.y - 24 + offset.y };
  const tip = { x: region.centroid.x + leaderOffset.x, y: region.centroid.y + leaderOffset.y };
  renderDimensionLeader(svg, labelPoint, tip, region.id, 'cat');
  const group = svgElement('g', { class: `cat-area-label ${selectedClass}` });
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 4, y: labelPoint.y - 9, width: width + 8, height: 18, rx: 5, class: 'cat-area-hit', 'data-dimension-id': region.id }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 7, width, height: 14, rx: 4, class: 'cat-area-bg', 'data-dimension-id': region.id }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 1, class: 'cat-area-text' }); text.textContent = label; group.append(text); svg.append(group);
}

function catNoteLabel(note) {
  const index = getCatNotes(documentModel).findIndex((entry) => entry.id === note.id);
  return `NOTE ${Math.max(1, index + 1)}`;
}

function renderCatNote(svg, note) {
  const labelPoint = { x: note.anchor.x + note.labelOffset.x, y: note.anchor.y + note.labelOffset.y };
  const label = catNoteLabel(note);
  const selectedClass = selected.kind === 'cat' && selected.id === note.id ? 'selected' : '';
  const dx = note.anchor.x - labelPoint.x;
  const dy = note.anchor.y - labelPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  svg.append(svgElement('line', { x1: labelPoint.x, y1: labelPoint.y, x2: note.anchor.x, y2: note.anchor.y, class: `cat-note-leader ${selectedClass}` }));
  const direction = { x: dx / length, y: dy / length };
  const normal = { x: -direction.y, y: direction.x };
  const arrow = [
    note.anchor,
    { x: note.anchor.x - direction.x * 7 + normal.x * 3, y: note.anchor.y - direction.y * 7 + normal.y * 3 },
    { x: note.anchor.x - direction.x * 7 - normal.x * 3, y: note.anchor.y - direction.y * 7 - normal.y * 3 },
  ];
  svg.append(svgElement('polygon', { points: arrow.map((point) => `${point.x},${point.y}`).join(' '), class: `cat-note-arrow ${selectedClass}` }));
  const width = Math.max(34, label.length * 4.1);
  const group = svgElement('g', { class: `cat-note-label ${selectedClass}` });
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 4, y: labelPoint.y - 8, width: width + 8, height: 16, rx: 4, class: 'cat-note-hit', 'data-cat-object-id': note.id, 'data-cat-note-id': note.id }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 6, width, height: 12, rx: 3, class: 'cat-note-bg', 'data-cat-object-id': note.id, 'data-cat-note-id': note.id }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 1, class: 'cat-note-text' });
  text.textContent = `${note.audioDataUrl ? '● ' : ''}${label}`;
  group.append(text);
  svg.append(group);
}

function renderCatMeasurement(svg, measurement, preview) {
  const derived = deriveCatMeasurement(measurement);
  const { start, end } = measurement;
  const selectedClass = !preview && selected.kind === 'cat' && selected.id === measurement.id ? 'selected' : '';
  const shared = `${preview ? 'preview' : ''} ${selectedClass}`;
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: derived.corner.x, y2: derived.corner.y, class: `cat-measure-leg ${shared}` }));
  svg.append(svgElement('line', { x1: derived.corner.x, y1: derived.corner.y, x2: end.x, y2: end.y, class: `cat-measure-leg ${shared}` }));
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `cat-measure-direct ${shared}` }));
  if (!preview) svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'cat-measure-line-hit', 'data-cat-object-id': measurement.id }));
  const horizontalPoint = { x: (start.x + derived.corner.x) / 2, y: start.y - 5 };
  const verticalPoint = { x: end.x + 7, y: (derived.corner.y + end.y) / 2 };
  const length = derived.pointToPointDistance || 1;
  const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const directPoint = { x: derived.midpoint.x + normal.x * 11, y: derived.midpoint.y + normal.y * 11 };
  renderCatMeasurementLabel(svg, horizontalPoint, `H ${formatFeetInches(derived.horizontalDistance)}`, measurement.id, shared);
  renderCatMeasurementLabel(svg, verticalPoint, `V ${formatFeetInches(derived.verticalDistance)}`, measurement.id, shared);
  renderCatMeasurementLabel(svg, directPoint, `↗ ${formatFeetInches(derived.pointToPointDistance)}`, measurement.id, shared);
  [start, end].forEach((point) => svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: Math.max(1.8, viewport.width / 350), class: `cat-measure-node ${shared}` })));
}

function renderCatMeasurementLabel(svg, point, label, referenceId, className) {
  const width = Math.max(28, label.length * 3.2);
  const group = svgElement('g', { class: `cat-measure-label ${className}` });
  group.append(svgElement('rect', { x: point.x - width / 2 - 3, y: point.y - 7, width: width + 6, height: 14, rx: 4, class: 'cat-measure-hit', 'data-cat-object-id': referenceId }));
  group.append(svgElement('rect', { x: point.x - width / 2, y: point.y - 5.5, width, height: 11, rx: 3, class: 'cat-measure-bg', 'data-cat-object-id': referenceId }));
  const text = svgElement('text', { x: point.x, y: point.y + 1, class: 'cat-measure-text' });
  text.textContent = label;
  group.append(text);
  svg.append(group);
}

function renderStairGraphics(svg, current) {
  documentModel.objects.filter((object) => object.type === 'stair' && object.host.boundaryId === current.id).forEach((stair) => renderStairShape(svg, current, stair, false));
}

function renderStairDimensions(svg, current) {
  documentModel.objects.filter((object) => object.type === 'stair' && object.host.boundaryId === current.id).forEach((stair) => {
    const byId = getStairVertexMap(current, stair);
    const points = [stair.anchors.openingStartVertexId, stair.anchors.outerStartVertexId, stair.anchors.outerEndVertexId, stair.anchors.openingEndVertexId]
      .map((id) => byId.get(id)).filter(Boolean);
    if (points.length !== 4) return;
    renderStairDimension(svg, current, stair, points);
    const edge = getStairInterfaceEdge(stair);
    const start = byId.get(edge.startVertexId);
    const end = byId.get(edge.endVertexId);
    if (start && end) addDimension(svg, start, end, edge.id);
  });
}

function renderStairPreview(svg, current) {
  if (!stairDraft || !selected.id || !stairDraft.totalRise) return;
  const options = { ...stairDraft };
  if (!validateStairPlacement(current, selected.id, options).valid) return;
  let count = 0;
  try {
    const preview = attachStairToBoundary(current, selected.id, options, (prefix) => `preview-${prefix}-${++count}`);
    renderStairShape(svg, preview.boundary, preview.stair, true);
    if (stairDraft.destination && stairDraft.landing) {
      svg.append(svgElement('line', { x1: stairDraft.landing.start.x, y1: stairDraft.landing.start.y, x2: stairDraft.landing.end.x, y2: stairDraft.landing.end.y, class: 'stair-landing-snap' }));
    }
    if (stairDraft.snappedStart || stairDraft.snappedEnd) {
      const byId = getStairVertexMap(preview.boundary, preview.stair);
      const snapIds = [stairDraft.snappedStart ? preview.stair.anchors.openingStartVertexId : null, stairDraft.snappedEnd ? preview.stair.anchors.openingEndVertexId : null];
      snapIds.filter(Boolean).map((id) => byId.get(id)).filter(Boolean).forEach((point) => {
        svg.append(svgElement('circle', { cx: point.x, cy: point.y, r: Math.max(5, viewport.width / 140), class: 'stair-snap-node' }));
      });
    }
  } catch { /* Inspector communicates invalid planning dimensions. */ }
}

function renderStairShape(svg, current, stair, preview) {
  const byId = getStairVertexMap(current, stair);
  const ids = stair.anchors;
  const polygonPoints = [ids.openingStartVertexId, ids.outerStartVertexId, ids.outerEndVertexId, ids.openingEndVertexId]
    .map((id) => byId.get(id)).filter(Boolean);
  if (polygonPoints.length !== 4) return;
  const invalidClass = stair.lifecycle?.needsReview ? 'invalid' : '';
  const selectedClass = selected.kind === 'stair' && selected.id === stair.id ? 'selected' : '';
  svg.append(svgElement('polygon', { points: polygonPoints.map((point) => `${point.x},${point.y}`).join(' '), class: `${preview ? 'stair-preview-fill' : 'stair-construction-fill'} ${invalidClass} ${selectedClass}` }));
  if (getDeckingLayer(documentModel).visible) {
    deriveStairBoardingSeams(current, stair).forEach((seam) => {
      svg.append(svgElement('line', { x1: seam.start.x, y1: seam.start.y, x2: seam.end.x, y2: seam.end.y, class: `stair-boarding-line${preview ? ' preview' : ''}`, 'data-stair-board-tread': seam.treadIndex + 1, 'data-stair-board-joint': seam.role }));
    });
  }
  deriveStairTreads(current, stair).forEach((tread, index) => {
    svg.append(svgElement('line', { x1: tread.start.x, y1: tread.start.y, x2: tread.end.x, y2: tread.end.y, class: `${preview ? 'stair-preview-tread' : 'stair-tread'} ${invalidClass}`, 'data-step': index + 1 }));
  });
  if (!preview) {
    renderStairSide(svg, current, stair, 'start', polygonPoints[0], polygonPoints[1]);
    renderStairSide(svg, current, stair, 'end', polygonPoints[3], polygonPoints[2]);
    renderStairInterfaceEdge(svg, current, stair, byId);
  }
  deriveStairFramingGeometry(current, stair, getFramingLayer(documentModel)).forEach((member) => {
    const memberClass = member.role === 'ledger' ? 'stair-framing-ledger' : `framing-joist continuous${member.role === 'lower-closure' ? ' stair-framing-closure' : ''}`;
    svg.append(svgElement('line', { x1: member.start.x, y1: member.start.y, x2: member.end.x, y2: member.end.y,
      class: `stair-framing-member ${memberClass}${preview ? ' stair-framing-preview' : ''}`, 'data-stair-framing-role': member.role }));
  });
}

function renderStairSide(svg, current, stair, side, start, end) {
  const referenceId = stairSideId(stair, side);
  const selectedClass = selected.kind === 'stair-side' && selected.id === referenceId ? 'selected' : '';
  const invalidClass = stair.lifecycle?.needsReview ? 'invalid' : '';
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `stair-side-visible ${selectedClass} ${invalidClass}` }));
  deriveStairSideSegments(current, stair, side, boundaries()).forEach((segment) => {
    const attributes = segment.role === 'shared-boundary'
      ? { 'data-edge-id': segment.boundaryEdgeId, 'data-boundary-id': segment.boundaryId }
      : { 'data-stair-side-id': referenceId, 'data-boundary-id': stair.host.boundaryId };
    svg.append(svgElement('line', { x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y, class: `stair-side-hit ${segment.role}`, ...attributes }));
  });
  const stairEditing = (selected.kind === 'stair' && selected.id === stair.id)
    || (selected.kind === 'dimension' && selected.id === stairDimensionId(stair))
    || (selected.kind === 'stair-side' && selected.id === referenceId);
  if (stairEditing) {
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'stair-side-edit-hit', 'data-stair-side-id': referenceId, 'data-boundary-id': stair.host.boundaryId }));
    svg.append(svgElement('circle', { cx: midpoint.x, cy: midpoint.y, r: Math.max(3.2, viewport.width / 190), class: 'stair-side-edit-handle' }));
  }
}

function renderStairDimension(svg, current, stair, points) {
  const referenceId = stairDimensionId(stair);
  if (!isDimensionReferenceVisible(documentModel, referenceId)) return;
  const source = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  const offset = getDimensionOffset(documentModel, referenceId);
  const leaderOffset = getDimensionLeaderOffset(documentModel, referenceId);
  const labelPoint = { x: source.x + offset.x, y: source.y + offset.y };
  const tip = { x: source.x + leaderOffset.x, y: source.y + leaderOffset.y };
  if (Math.hypot(offset.x, offset.y) > 3) renderDimensionLeader(svg, labelPoint, tip, referenceId);
  const stairs = documentModel.objects.filter((object) => object.type === 'stair');
  const number = Math.max(1, stairs.findIndex((object) => object.id === stair.id) + 1);
  const label = `STAIRS ${number} · ${stair.dimensions.riserCount}R · ${stair.dimensions.treadCount}T`;
  const width = Math.max(54, label.length * 3.4);
  const selectedClass = (selected.kind === 'dimension' && selected.id === referenceId) || (selected.kind === 'stair' && selected.id === stair.id) ? 'selected' : '';
  const invalidClass = stair.lifecycle?.needsReview ? 'invalid' : '';
  const group = svgElement('g', { class: 'dimension-annotation stair-dimension' });
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 3, y: labelPoint.y - 8, width: width + 6, height: 16, rx: 4, class: 'dimension-hit', 'data-dimension-id': referenceId, 'data-boundary-id': current.id }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 6, width, height: 12, rx: 3, class: `dimension-bg stair ${selectedClass} ${invalidClass}`, 'data-dimension-id': referenceId, 'data-boundary-id': current.id }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 1, class: `dimension-text stair ${invalidClass}` });
  text.textContent = label;
  group.append(text);
  svg.append(group);
}

function renderStairInterfaceEdge(svg, current, stair, byId) {
  const edge = getStairInterfaceEdge(stair);
  const start = byId.get(edge.startVertexId);
  const end = byId.get(edge.endVertexId);
  if (!start || !end) return;
  renderEdgeConstructionGraphics(svg, current, start, end, edge.properties);
  const selectedClass = selected.kind === 'stair-edge' && selected.id === edge.id ? 'selected' : '';
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `stair-interface-visible ${selectedClass}` }));
  svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'stair-interface-hit', 'data-stair-edge-id': edge.id }));
}

function renderRailingGraphics(svg) {
  if (!getRailingLayer(documentModel).visible && !railingDraft) return;
  const geometries = getAllRailingGeometries();
  geometries.forEach((geometry) => renderRailingGeometry(svg, geometry, false));
  deriveRailingPostLayout(geometries, documentModel.railingCornerSettings).posts.forEach((post) => {
    const selectedClass = selected.kind === 'railing-post' && selected.id === post.id ? 'selected' : '';
    post.markers.forEach((marker) => {
      const size = marker.size ?? 3.5;
      svg.append(svgElement('rect', { x: marker.x - size / 2, y: marker.y - size / 2, width: size, height: size, rx: .35, class: `railing-run-post ${post.doubled ? 'double-corner' : ''} ${selectedClass}` }));
      const hitSize = Math.max(12, size * 3);
      svg.append(svgElement('rect', { x: marker.x - hitSize / 2, y: marker.y - hitSize / 2, width: hitSize, height: hitSize, class: 'railing-post-hit', 'data-railing-post-id': post.id }));
    });
  });
  if (railingDraft?.geometry) renderRailingGeometry(svg, railingDraft.geometry, true);
  [railingDraft?.startAnchor, railingDraft?.endAnchor].filter(Boolean).forEach((anchor, index) => {
    const size = Math.max(7, viewport.width / 95);
    svg.append(svgElement('rect', {
      x: anchor.point.x - size / 2,
      y: anchor.point.y - size / 2,
      width: size,
      height: size,
      rx: size * .18,
      class: `railing-snap-marker ${anchor.snapType} ${index === 0 ? 'start' : 'end'}`,
      transform: `rotate(45 ${anchor.point.x} ${anchor.point.y})`,
    }));
  });
}

function renderRailingGeometry(svg, geometry, preview) {
  const selectedClass = !preview && selected.kind === 'railing' && selected.id === geometry.railing.id ? 'selected' : '';
  svg.append(svgElement('line', { x1: geometry.start.x, y1: geometry.start.y, x2: geometry.end.x, y2: geometry.end.y, class: `railing-run-visible ${preview ? 'preview' : ''} ${selectedClass}` }));
  if (preview) geometry.posts.forEach((post) => {
    const size = 4;
    svg.append(svgElement('rect', { x: post.x - size / 2, y: post.y - size / 2, width: size, height: size, rx: .5, class: 'railing-run-post preview' }));
  });
  if (!preview) {
    svg.append(svgElement('line', { x1: geometry.start.x, y1: geometry.start.y, x2: geometry.end.x, y2: geometry.end.y, class: 'railing-run-hit', 'data-railing-id': geometry.railing.id }));
  }
}

function renderBoundarySvg(svg, current, validation) {
  const points = current.vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ');
  const depthFactor = getBoundaryLevelDown(current) / 7.5;
  const shade = Math.max(5, 28 - depthFactor * 3);
  const framingLayer = getFramingLayer(documentModel);
  const rimJoistsVisible = framingLayer.visible && framingLayer.joistsVisible;
  if (getDeckingLayer(documentModel).visible) {
    svg.append(svgElement('polygon', { points, class: `boundary-fill ${validation.valid ? '' : 'invalid'} ${current.id === activeBoundaryId ? 'active-deck' : ''}`, style: `fill: rgb(${shade} ${shade + 28} ${shade + 27} / 82%)`, 'data-boundary-id': current.id }));
    renderDeckBoarding(svg, current);
  }
  current.edges.forEach((edge, index) => {
    const arc = getBoundaryArc(current, edge.id);
    if (arc) {
      if (edge.id !== arc.id) return;
      for (let segment = 0; segment < arc.points.length - 1; segment += 1) {
        renderEdgeConstructionGraphics(svg, current, arc.points[segment], arc.points[segment + 1], normalizeBoundaryEdge(arc.record.originalEdge).properties);
      }
      const path = `M ${arc.start.x} ${arc.start.y} A ${arc.radius} ${arc.radius} 0 0 ${arc.sweep > 0 ? 1 : 0} ${arc.end.x} ${arc.end.y}`;
      const rimClass = rimJoistsVisible && normalizeRimJoist(normalizeBoundaryEdge(arc.record.originalEdge).properties.attachments.rimJoist).enabled ? 'rim-joist' : '';
      svg.append(svgElement('path', { d: path, class: `boundary-edge-visible arch-edge ${rimClass} ${selected.id === arc.id ? 'selected' : ''}`, fill: 'none' }));
      svg.append(svgElement('path', { d: path, class: 'boundary-edge arch-edge', fill: 'none', 'data-edge-id': arc.id, 'data-boundary-id': current.id }));
      return;
    }
    const start = current.vertices[index];
    const end = current.vertices[(index + 1) % current.vertices.length];
    renderEdgeConstructionGraphics(svg, current, start, end, normalizeBoundaryEdge(edge).properties);
    const selectedClass = selected.kind === 'edge' && selected.id === edge.id ? 'selected' : '';
    const rimClass = rimJoistsVisible && normalizeRimJoist(normalizeBoundaryEdge(edge).properties.attachments.rimJoist).enabled ? 'rim-joist' : '';
    svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `boundary-edge-visible ${edge.role} ${rimClass} ${selectedClass}` }));
    const hit = svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'boundary-edge', 'data-edge-id': edge.id, 'data-boundary-id': current.id });
    svg.append(hit);
  });
  const markerSize = Math.max(2.8, viewport.width / 150);
  const hitSize = viewport.width / Math.max(svg.clientWidth || 1000, 1) * 34;
  current.vertices.forEach((vertex) => {
    if (vertex.archLineId) return;
    svg.append(svgElement('rect', { x: vertex.x - hitSize / 2, y: vertex.y - hitSize / 2, width: hitSize, height: hitSize, class: 'vertex-hit', 'data-vertex-id': vertex.id, 'data-boundary-id': current.id }));
    svg.append(svgElement('rect', { x: vertex.x - markerSize / 2, y: vertex.y - markerSize / 2, width: markerSize, height: markerSize, rx: markerSize * .12, class: `vertex ${selected.kind === 'vertex' && selected.id === vertex.id ? 'selected' : ''} ${mergeCandidateId === vertex.id ? 'merge-ready' : ''}`, transform: `rotate(45 ${vertex.x} ${vertex.y})` }));
    if (vertex.locked) {
      const lock = svgElement('text', { x: vertex.x + markerSize * 1.15, y: vertex.y - markerSize * .9, class: 'constraint-anchor vertex-anchor' });
      lock.textContent = '⚓';
      svg.append(lock);
    }
  });
}

function renderDeckBoarding(svg, current) {
  if (!getDeckBoarding(current)) return;
  const byId = new Map(current.vertices.map((vertex) => [vertex.id, vertex]));
  const stairExclusions = documentModel.objects
    .filter((object) => object.type === 'stair' && object.host?.boundaryId === current.id)
    .map((stair) => getStairVertices(current, stair))
    .filter((polygon) => polygon.length === 4);
  deriveDeckBoardingSegments(current, stairExclusions).forEach((segment) => {
    if (segment.curved) svg.append(svgElement('polyline', { points: segment.points.map((point) => `${point.x},${point.y}`).join(' '), class: 'deck-boarding-line', fill: 'none' }));
    else svg.append(svgElement('line', { x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y, class: 'deck-boarding-line' }));
  });
}

function renderBoundaryDimensions(svg, current) {
  current.edges.forEach((edge, index) => {
    const arc = getBoundaryArc(current, edge.id);
    if (arc) {
      if (edge.id === arc.id && (selected.id === arc.id || archMode?.edgeId === arc.id)) renderArchDimensions(svg, current, arc);
      return;
    }
    const temporaryChamferDimension = chamferDraft?.boundary?.id === current.id && chamferDraft.chamferEdgeId === edge.id;
    const stairGeneratedDimension = Boolean(edge.properties?.attachments?.stairId);
    if (temporaryChamferDimension || stairGeneratedDimension) return;
    addDimension(svg, current.vertices[index], current.vertices[(index + 1) % current.vertices.length], edge.id);
  });
  renderAreaDimension(svg, current);
}

function renderAreaDimension(svg, current) {
  const referenceId = areaDimensionId(current);
  if (!isDimensionReferenceVisible(documentModel, referenceId)) return;
  const center = getBoundaryCentroid(current);
  const offset = getDimensionOffset(documentModel, referenceId);
  const leaderOffset = getDimensionLeaderOffset(documentModel, referenceId);
  const labelPoint = { x: center.x + offset.x, y: center.y - 24 + offset.y };
  const tip = { x: center.x + leaderOffset.x, y: center.y + leaderOffset.y };
  const label = `AREA · ${formatSquareFeet(current.computed.areaSquareInches)}`;
  const levelDown = getBoundaryLevelDown(current);
  const width = Math.max(46, label.length * 3.5);
  const selectedClass = selected.kind === 'dimension' && selected.id === referenceId ? 'selected' : '';
  renderDimensionLeader(svg, labelPoint, tip, referenceId);
  const group = svgElement('g', { class: 'dimension-annotation area-dimension' });
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 3, y: labelPoint.y - 8, width: width + 6, height: 16, rx: 4, class: 'dimension-hit', 'data-dimension-id': referenceId, 'data-boundary-id': current.id }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 6, width, height: 12, rx: 3, class: `dimension-bg area ${selectedClass}`, 'data-dimension-id': referenceId, 'data-boundary-id': current.id }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 1, class: 'dimension-text area' });
  text.textContent = label;
  group.append(text);
  if (levelDown > 0) {
    const levelLabel = `↓ ${formatInches(levelDown)}`;
    const levelWidth = Math.max(24, levelLabel.length * 3.5);
    group.append(svgElement('rect', { x: labelPoint.x - levelWidth / 2, y: labelPoint.y + 8, width: levelWidth, height: 10, rx: 2.5, class: `dimension-bg deck-level ${selectedClass}`, 'data-dimension-id': referenceId, 'data-boundary-id': current.id }));
    const levelText = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 13.5, class: 'dimension-text deck-level' });
    levelText.textContent = levelLabel;
    group.append(levelText);
  }
  svg.append(group);
}

function renderLevelDownGraphics(svg, current) {
  documentModel.objects.filter((object) => object.type === 'level-down' && object.host.boundaryId === current.id).forEach((levelDown) => {
    const region = deriveLevelDownRegion(levelDown, current);
    if (region) {
      const depthFactor = Math.max(1, getLevelDownDepth(levelDown, current) / 7.5);
      svg.append(svgElement('polygon', {
        points: region.points.map((point) => `${point.x},${point.y}`).join(' '),
        class: 'level-down-region',
        'fill-opacity': Math.min(.16 + depthFactor * .08, .58),
      }));
    }
    levelDown.segments.forEach((segment, index) => {
      const start = levelDown.vertices[index];
      const end = levelDown.vertices[index + 1];
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const normal = { x: -(end.y - start.y) / segmentLength, y: (end.x - start.x) / segmentLength };
      const selectedClass = selected.kind === 'level-down' && selected.id === segment.id ? 'selected' : '';
      svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: `level-down-line ${selectedClass}` }));
      if (levelDown.properties?.finishes?.pictureFrame) svg.append(svgElement('line', { x1: start.x + normal.x * 3, y1: start.y + normal.y * 3, x2: end.x + normal.x * 3, y2: end.y + normal.y * 3, class: 'level-down-picture-frame' }));
      if (levelDown.properties?.finishes?.fascia) svg.append(svgElement('line', { x1: start.x - normal.x * 2, y1: start.y - normal.y * 2, x2: end.x - normal.x * 2, y2: end.y - normal.y * 2, class: 'level-down-fascia' }));
      svg.append(svgElement('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'level-down-hit', 'data-level-down-segment-id': segment.id }));
    });
  });
  if (levelDownDraft.length) {
    const points = [...levelDownDraft.map((entry) => entry.point), ...(levelDownPointer ? [levelDownPointer.point] : [])];
    svg.append(svgElement('polyline', { points: points.map((entry) => `${entry.x},${entry.y}`).join(' '), class: 'level-down-preview', fill: 'none' }));
    points.forEach((point) => svg.append(svgElement('rect', { x: point.x - 2.5, y: point.y - 2.5, width: 5, height: 5, class: 'level-down-marker', transform: `rotate(45 ${point.x} ${point.y})` })));
  }
}

function renderLevelDownDimensions(svg, current) {
  documentModel.objects.filter((object) => object.type === 'level-down' && object.host.boundaryId === current.id).forEach((levelDown) => {
    const region = deriveLevelDownRegion(levelDown, current);
    if (region) renderLevelDownDimension(svg, levelDown, region, getLevelDownDepth(levelDown, current));
  });
}

function renderLevelDownDimension(svg, levelDown, region, totalDepth) {
  const referenceId = levelDownDimensionId(levelDown);
  if (!isDimensionReferenceVisible(documentModel, referenceId)) return;
  const source = region.centroid;
  const offset = getDimensionOffset(documentModel, referenceId);
  const leaderOffset = getDimensionLeaderOffset(documentModel, referenceId);
  const labelPoint = { x: source.x + offset.x, y: source.y - 20 + offset.y };
  const tip = { x: source.x + leaderOffset.x, y: source.y + leaderOffset.y };
  renderDimensionLeader(svg, labelPoint, tip, referenceId);
  const label = `↓ ${formatInches(totalDepth)}`;
  const width = Math.max(30, label.length * 4);
  const selectedClass = selected.kind === 'dimension' && selected.id === referenceId ? 'selected' : '';
  const group = svgElement('g', { class: 'dimension-annotation level-down-dimension' });
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 3, y: labelPoint.y - 8, width: width + 6, height: 16, rx: 4, class: 'dimension-hit', 'data-dimension-id': referenceId }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 6, width, height: 12, rx: 3, class: `dimension-bg level-down ${selectedClass}`, 'data-dimension-id': referenceId }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + 1, class: 'dimension-text level-down' });
  text.textContent = label;
  group.append(text);
  svg.append(group);
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
  if (getRailingLayer(documentModel).visible && (properties.safety.railing === 'required' || properties.safety.railing === 'existing')) {
    const postCount = Math.max(2, Math.ceil(length / 48) + 1);
    for (let index = 0; index < postCount; index += 1) {
      const t = index / (postCount - 1);
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      svg.append(svgElement('rect', { x: x - 2, y: y - 2, width: 4, height: 4, class: `railing-post ${properties.safety.railing}` }));
    }
  }
}

function addDimension(svg, start, end, referenceId) {
  if (!isDimensionReferenceVisible(documentModel, referenceId)) return;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 12) return;
  const offsetX = (-dy / length) * 8;
  const offsetY = (dx / length) * 8;
  const dimensionBoundary = boundaryForReference(referenceId);
  const locked = dimensionBoundary?.edges.some((edge) => edge.id === referenceId) && isEdgeLocked(dimensionBoundary, referenceId);
  const orientation = dimensionBoundary ? getEdgeOrientationConstraint(dimensionBoundary, referenceId) : null;
  const constraintMark = locked ? '⚓ ' : orientation?.type === 'fixed-angle' ? '⚓∠ ' : orientation?.type === 'horizontal' ? 'H · ' : orientation?.type === 'vertical' ? 'V · ' : '';
  const label = `${constraintMark}${formatFeetInches(length)}`;
  const width = Math.max(25, label.length * 3.3);
  const annotationOffset = getDimensionOffset(documentModel, referenceId);
  const leaderOffset = getDimensionLeaderOffset(documentModel, referenceId);
  const labelPoint = { x: midX + offsetX + annotationOffset.x, y: midY + offsetY + annotationOffset.y };
  const tip = { x: midX + leaderOffset.x, y: midY + leaderOffset.y };
  renderDimensionLeader(svg, labelPoint, tip, referenceId);
  const group = svgElement('g', { class: 'dimension-annotation' });
  const selectedClass = selected.kind === 'dimension' && selected.id === referenceId ? 'selected' : '';
  group.append(svgElement('rect', { x: labelPoint.x - width / 2 - 2, y: labelPoint.y - 6, width: width + 4, height: 12, rx: 3, class: 'dimension-hit', 'data-dimension-id': referenceId }));
  group.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 4, width, height: 8, rx: 2, class: `dimension-bg ${selectedClass}`, 'data-dimension-id': referenceId }));
  const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + .3, class: 'dimension-text' });
  text.textContent = label;
  group.append(text);
  svg.append(group);
}

function renderChamferDimension(svg, draft) {
  const edge = draft.boundary.edges.find((entry) => entry.id === draft.chamferEdgeId);
  if (!edge) return;
  const byId = new Map(draft.boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const start = byId.get(edge.startVertexId);
  const end = byId.get(edge.endVertexId);
  const corner = draft.originalCorner;
  if (!start || !end || !corner) return;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const worldPerPixel = viewport.width / Math.max(svg.clientWidth || 1000, 1);
  const markerSize = Math.max(3.5, worldPerPixel * 9);
  const triangleCenter = { x: (corner.x + start.x + end.x) / 3, y: (corner.y + start.y + end.y) / 3 };
  const guideLabelOffset = Math.max(5, worldPerPixel * 13);

  [start, end].forEach((endpoint) => {
    svg.append(svgElement('line', { x1: corner.x, y1: corner.y, x2: endpoint.x, y2: endpoint.y, class: 'chamfer-construction-guide' }));
    const guideMidpoint = { x: (corner.x + endpoint.x) / 2, y: (corner.y + endpoint.y) / 2 };
    const away = { x: guideMidpoint.x - triangleCenter.x, y: guideMidpoint.y - triangleCenter.y };
    const magnitude = Math.hypot(away.x, away.y) || 1;
    const labelPoint = { x: guideMidpoint.x + away.x / magnitude * guideLabelOffset, y: guideMidpoint.y + away.y / magnitude * guideLabelOffset };
    const label = formatInches(draft.setback);
    const width = Math.max(24, label.length * 3.5);
    svg.append(svgElement('rect', { x: labelPoint.x - width / 2, y: labelPoint.y - 5, width, height: 10, rx: 2.5, class: 'chamfer-setback-bg' }));
    const text = svgElement('text', { x: labelPoint.x, y: labelPoint.y + .5, class: 'chamfer-setback-text' });
    text.textContent = label;
    svg.append(text);
  });

  svg.append(svgElement('rect', { x: corner.x - markerSize / 2, y: corner.y - markerSize / 2, width: markerSize, height: markerSize, rx: markerSize * .12, class: 'chamfer-original-node', transform: `rotate(45 ${corner.x} ${corner.y})` }));

  const anglePoint = { x: corner.x + (midpoint.x - corner.x) * .34, y: corner.y + (midpoint.y - corner.y) * .34 };
  const angle = svgElement('text', { x: anglePoint.x, y: anglePoint.y + 1, class: 'chamfer-angle-text' });
  angle.textContent = '45°';
  svg.append(angle);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const diagonalLength = Math.hypot(dx, dy);
  const diagonalOffset = Math.max(8, worldPerPixel * 15);
  const labelPoint = { x: midpoint.x - dy / diagonalLength * diagonalOffset, y: midpoint.y + dx / diagonalLength * diagonalOffset };
  const diagonalLabel = formatFeetInches(diagonalLength);
  const diagonalWidth = Math.max(27, diagonalLabel.length * 3.4);
  svg.append(svgElement('rect', { x: labelPoint.x - diagonalWidth / 2, y: labelPoint.y - 5, width: diagonalWidth, height: 10, rx: 2.5, class: 'chamfer-diagonal-bg' }));
  const diagonalText = svgElement('text', { x: labelPoint.x, y: labelPoint.y + .5, class: 'chamfer-diagonal-text' });
  diagonalText.textContent = diagonalLabel;
  svg.append(diagonalText);
}

function renderDimensionLeader(svg, labelPoint, tip, referenceId, variant = '') {
  const active = dimensionLeaderMode?.referenceId === referenceId;
  const variantClass = variant ? ` ${variant}` : '';
  const dx = tip.x - labelPoint.x;
  const dy = tip.y - labelPoint.y;
  const length = Math.hypot(dx, dy);
  if (length > 1) {
    svg.append(svgElement('line', { x1: labelPoint.x, y1: labelPoint.y, x2: tip.x, y2: tip.y, class: `dimension-leader${variantClass} ${active ? 'repositioning' : ''}` }));
    const angle = Math.atan2(dy, dx);
    const size = Math.max(4, viewport.width / 175);
    const arrow = [tip, { x: tip.x - Math.cos(angle - .55) * size, y: tip.y - Math.sin(angle - .55) * size }, { x: tip.x - Math.cos(angle + .55) * size, y: tip.y - Math.sin(angle + .55) * size }];
    svg.append(svgElement('polygon', { points: arrow.map((point) => `${point.x},${point.y}`).join(' '), class: `dimension-leader-arrow${variantClass} ${active ? 'repositioning' : ''}` }));
  }
  if (active) {
    const pulse = Math.max(5, viewport.width / 135);
    svg.append(svgElement('circle', { cx: tip.x, cy: tip.y, r: pulse, class: 'dimension-arrow-pulse' }));
  }
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
    if (snapState.inference) renderNodeInferenceGuide(svg, snapState.inference, pointerWorld, markerSize);
  }
}

function renderNodeInferenceGuide(svg, inference, snappedPoint, markerSize) {
  const reference = inference.referencePoint;
  const direction = { x: Math.cos(inference.guideAngle), y: Math.sin(inference.guideAngle) };
  const projection = (snappedPoint.x - reference.x) * direction.x + (snappedPoint.y - reference.y) * direction.y;
  const projectedPoint = { x: reference.x + direction.x * projection, y: reference.y + direction.y * projection };
  const extension = Math.max(18, viewport.width / 24);
  const lineStart = { x: reference.x - direction.x * extension, y: reference.y - direction.y * extension };
  const lineEnd = { x: projectedPoint.x + direction.x * extension, y: projectedPoint.y + direction.y * extension };
  svg.append(svgElement('line', { x1: lineStart.x, y1: lineStart.y, x2: lineEnd.x, y2: lineEnd.y, class: 'node-inference-guide' }));
  svg.append(svgElement('circle', { cx: reference.x, cy: reference.y, r: markerSize * 1.7, class: 'node-inference-reference-halo' }));
  svg.append(svgElement('rect', { x: reference.x - markerSize / 2, y: reference.y - markerSize / 2, width: markerSize, height: markerSize, class: 'node-inference-reference', transform: `rotate(45 ${reference.x} ${reference.y})` }));
  svg.append(svgElement('circle', { cx: snappedPoint.x, cy: snappedPoint.y, r: markerSize * .7, class: 'node-inference-intersection' }));
}

function bindEvents() {
  const stairCoveringSelect = app.querySelector('#stair-covering-style');
  if (stairCoveringSelect) stairCoveringSelect.addEventListener('change', () => {
    const stair = selectedStairObject();
    if (!stair) return;
    try {
      const updated = setStairCoveringStyle(stair, stairCoveringSelect.value);
      message = 'Stair covering updated · Takeoff recalculated';
      commit(upsertObject(documentModel, updated), 'Change stair covering');
    } catch (error) { message = error.message; render(); }
  });
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  app.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action, button)));
  app.querySelectorAll('[data-takeoff-quantity]').forEach((input) => input.addEventListener('change', () => {
    const quantity = Number(input.value);
    if (!Number.isFinite(quantity) || quantity < 0) { message = 'Enter a valid material quantity'; render(); return; }
    message = 'Takeoff quantity adjusted';
    commit(updateTakeoffLine(documentModel, input.dataset.takeoffQuantity, { quantity }), 'Adjust takeoff material quantity');
  }));
  app.querySelectorAll('[data-takeoff-price]').forEach((input) => input.addEventListener('change', () => {
    const unitPrice = input.value === '' ? null : Number(input.value);
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) { message = 'Enter a valid unit price'; render(); return; }
    message = unitPrice === null ? 'Material price cleared' : 'Material price updated';
    commit(updateTakeoffLine(documentModel, input.dataset.takeoffPrice, { unitPrice }), 'Update takeoff material price');
  }));
  const projectNameInput = app.querySelector('#project-name-input');
  if (projectNameInput) projectNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); handleAction('rename-project'); }
  });
  const role = app.querySelector('#edge-role');
  if (role) role.addEventListener('change', () => {
    let next = setEdgeRole(boundary(), selected.id, role.value);
    next = updateEdgeProperties(next, selected.id, { attachments: { ledger: role.value === 'house' } });
    commitBoundary(markBoundaryEdited(next), 'Set edge relationship');
  });
  const railing = app.querySelector('#edge-railing');
  if (railing) railing.addEventListener('change', () => { message = 'Railing intent updated'; commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { safety: { railing: railing.value } })), 'Update edge railing intent'); });
  app.querySelectorAll('[data-edge-property]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.edgeProperty;
    const patch = key === 'demolition' ? { existingConditions: { demolition: input.checked } } : { finishes: { [key]: input.checked } };
    message = `${key} property updated`;
    commitSelectedEdgeProperties(patch, 'Update edge construction properties');
  }));
  const gridSpacing = app.querySelector('#grid-spacing');
  if (gridSpacing) gridSpacing.addEventListener('change', () => { gridSetting = gridSpacing.value; render(); });
  const gridVisibility = app.querySelector('#grid-visible');
  if (gridVisibility) gridVisibility.addEventListener('change', () => {
    message = `Construction grid layer ${gridVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setGridLayerVisibility(documentModel, gridVisibility.checked), 'Toggle Construction grid layer');
  });
  const dimensionVisibility = app.querySelector('#dimensions-visible');
  if (dimensionVisibility) dimensionVisibility.addEventListener('change', () => {
    message = `Dimensions layer ${dimensionVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setDimensionLayerVisibility(documentModel, dimensionVisibility.checked), 'Toggle Dimensions layer');
  });
  const railingVisibility = app.querySelector('#railing-visible');
  if (railingVisibility) railingVisibility.addEventListener('change', () => {
    message = `Railing layer ${railingVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setRailingLayerVisibility(documentModel, railingVisibility.checked), 'Toggle Railing layer');
  });
  const framingVisibility = app.querySelector('#framing-visible');
  if (framingVisibility) framingVisibility.addEventListener('change', () => {
    message = `Framing layer ${framingVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setFramingLayerVisibility(documentModel, framingVisibility.checked), 'Toggle Framing layer');
  });
  const joistsVisibility = app.querySelector('#joists-visible');
  if (joistsVisibility) joistsVisibility.addEventListener('change', () => {
    message = `Joists layer ${joistsVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setJoistLayerVisibility(documentModel, joistsVisibility.checked), 'Toggle Joists layer');
  });
  const catConstructionVisibility = app.querySelector('#cat-construction-visible');
  if (catConstructionVisibility) catConstructionVisibility.addEventListener('change', () => {
    message = `CAT construction lines ${catConstructionVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setCatConstructionLayerVisibility(documentModel, catConstructionVisibility.checked), 'Toggle CAT construction lines');
  });
  const catDimensionsVisibility = app.querySelector('#cat-dimensions-visible');
  if (catDimensionsVisibility) catDimensionsVisibility.addEventListener('change', () => {
    message = `CAT dimensions ${catDimensionsVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setCatDimensionLayerVisibility(documentModel, catDimensionsVisibility.checked), 'Toggle CAT dimensions');
  });
  const deckingVisibility = app.querySelector('#decking-visible');
  if (deckingVisibility) deckingVisibility.addEventListener('change', () => {
    message = `Decking layer ${deckingVisibility.checked ? 'shown' : 'hidden'}`;
    commit(setDeckingLayerVisibility(documentModel, deckingVisibility.checked), 'Toggle Decking layer');
  });
  const edgeSnap = app.querySelector('#snap-edges');
  if (edgeSnap) edgeSnap.addEventListener('change', () => {
    message = `Edge and corner snap ${edgeSnap.checked ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { edges: edgeSnap.checked }), 'Update edge snap settings');
  });
  const gridSnap = app.querySelector('#snap-grid');
  if (gridSnap) gridSnap.addEventListener('change', () => {
    message = `Grid snap ${gridSnap.checked ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { grid: gridSnap.checked }), 'Update grid snap settings');
  });
  const nodeInference = app.querySelector('#snap-node-inference');
  if (nodeInference) nodeInference.addEventListener('change', () => {
    message = `Node inference ${nodeInference.checked ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { nodeInference: nodeInference.checked }), 'Update node inference settings');
  });
  const diagonalInference = app.querySelector('#snap-diagonal-inference');
  if (diagonalInference) diagonalInference.addEventListener('change', () => {
    message = `22.5° and 45° node inference ${diagonalInference.checked ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { diagonalInference: diagonalInference.checked }), 'Update diagonal inference settings');
  });
  const railingSystem = app.querySelector('#quick-railing-system');
  if (railingSystem) railingSystem.addEventListener('change', () => {
    const railing = documentModel.objects.find((object) => object.type === 'railing-run' && object.id === selected.id);
    if (!railing) return;
    message = `${railingSystem.options[railingSystem.selectedIndex].text} assigned`;
    commit(upsertObject(documentModel, updateRailingSettings(railing, { system: railingSystem.value })), 'Set railing system');
  });
  const svg = app.querySelector('.model-canvas');
  svg.addEventListener('pointerdown', (event) => canvasPointerDown(svg, event));
  svg.addEventListener('pointermove', (event) => canvasPointerMove(svg, event));
  svg.addEventListener('pointerup', (event) => finishPointerGesture(svg, event));
  svg.addEventListener('pointercancel', (event) => finishPointerGesture(svg, event));
  svg.addEventListener('wheel', (event) => zoomAtPointer(svg, event), { passive: false });
  svg.addEventListener('contextmenu', (event) => event.preventDefault());
  svg.addEventListener('dblclick', (event) => canvasDoubleClick(svg, event));
}

function setMode(nextMode) {
  archMode = null; archGesture = null; archDraft = null;
  mode = nextMode;
  utilityPanel = null;
  projectMenuOpen = false;
  exportMenuOpen = false;
  boardingDirectionMode = null;
  pendingDeckDeleteId = null;
  moveBoundaryMode = null;
  moveBoundaryGesture = null;
  dimensionLeaderMode = null;
  dimensionLeaderGesture = null;
  chamferMode = null;
  chamferGesture = null;
  chamferDraft = null;
  numericBuffer = '';
  stairGesture = null;
  stairSideGesture = null;
  railingGesture = null;
  railingDraft = null;
  framingNodeGesture = null;
  joistMeshMoveMode = null;
  joistMeshMoveGesture = null;
  singleJoistMode = null;
  blockingAddMode = null;
  blockingMoveMode = null;
  blockingMoveGesture = null;
  if (nextMode !== 'cat') { catDraft = null; catPointer = null; }
  if (nextMode !== 'framing') { framingDraft = null; framingGesture = null; joistTargetBoundaryId = null; }
  if (nextMode !== 'level-down') { levelDownDraft = []; levelDownPointer = null; }
  if (mode !== 'stair') stairDraft = null;
  if (mode !== 'draw') { draft = []; pointerWorld = null; message = 'Ready'; }
  if (mode === 'draw') message = 'Click the first corner of the deck';
  if (mode === 'stair') message = 'Press a boundary edge and drag outward to build stairs';
  if (mode === 'railing') {
    if (!getRailingLayer(documentModel).visible) {
      documentModel = setRailingLayerVisibility(documentModel, true);
      persist();
    }
    message = 'Press an edge, corner, or grid point and drag to another snap target';
  }
  if (mode === 'cat') {
    let next = documentModel;
    if (!getCatConstructionLayer(next).visible) next = setCatConstructionLayerVisibility(next, true);
    if (!getCatDimensionLayer(next).visible) next = setCatDimensionLayerVisibility(next, true);
    if (next !== documentModel) { documentModel = next; persist(); }
    catDraft = null;
    catPointer = null;
    message = ({
      measure: 'Measuring tape · choose the first point',
      offset: 'Offset · choose a straight CAT Line',
      trim: 'Trim · touch the CAT Line segment to remove',
      extend: 'Extend · select the CAT Line or arc to extend near the desired endpoint',
      note: 'CAT Note · choose the arrow point',
    })[catTool] ?? 'CAT Line · choose the first point';
  }
  if (mode === 'framing') {
    if (!getFramingLayer(documentModel).visible) {
      documentModel = setFramingLayerVisibility(documentModel, true);
      persist();
    }
    pointerWorld = null;
    if (framingTool === 'joist') {
      joistTargetBoundaryId = null;
      message = 'Joist Field · select the Deck Boundary to fill';
    } else message = framingTool === 'post' ? 'Post / Footing · tap beneath a Beam or Rim / Flush' : 'Choose the first endpoint';
  }
  if (mode === 'level-down') message = 'Click a boundary edge or corner to start Level Down';
  render();
}

function canvasPointerDown(svg, event) {
  const vertexId = event.target.dataset.vertexId;
  const edgeId = event.target.dataset.edgeId;
  const stairEdgeId = event.target.dataset.stairEdgeId;
  const stairSideReferenceId = event.target.dataset.stairSideId;
  const dimensionId = event.target.dataset.dimensionId;
  const railingId = event.target.dataset.railingId;
  const railingPostId = event.target.dataset.railingPostId;
  const levelDownSegmentId = event.target.dataset.levelDownSegmentId;
  const catObjectId = event.target.dataset.catObjectId;
  const catBoundaryId = event.target.dataset.catBoundaryId;
  const framingId = event.target.dataset.framingId;
  const blockingRowId = event.target.dataset.blockingRowId;
  const framingNode = event.target.dataset.framingNode;
  const catNoteId = event.target.dataset.catNoteId;
  const targetBoundaryId = event.target.dataset.boundaryId ?? boundaryForReference(vertexId ?? edgeId ?? dimensionId ?? levelDownSegmentId)?.id;
  if (catArchMode && event.button === 0) {
    if (catObjectId !== catArchMode.lineId) { message = 'Drag the selected CAT Line to shape its arc'; updateStatusMessage(); return; }
    const line = getCatLines(documentModel).find((entry) => entry.id === catArchMode.lineId);
    if (!line) return;
    event.preventDefault(); catArchGesture = { pointerId: event.pointerId, line }; catArchDraft = null; svg.setPointerCapture(event.pointerId); return;
  }
  if (archMode && event.button === 0) {
    if (edgeId !== archMode.edgeId || targetBoundaryId !== archMode.boundaryId) { message = 'Drag the selected edge or arc midpoint'; updateStatusMessage(); return; }
    event.preventDefault();
    archGesture = { pointerId: event.pointerId, boundary: boundaryById(archMode.boundaryId) };
    archDraft = null;
    svg.setPointerCapture(event.pointerId);
    return;
  }
  if (edgeId && getBoundaryArc(boundaryById(targetBoundaryId), edgeId) && event.button === 0 && !boardingDirectionMode) {
    event.preventDefault();
    if (mode !== 'select') { message = 'Curved edges do not accept straight construction attachments. Use a straight reference or Straighten first.'; updateStatusMessage(); return; }
    activateBoundary(targetBoundaryId);
    selected = { kind: 'edge', id: getBoundaryArc(boundary(), edgeId).id };
    render(); return;
  }
  if (moveBoundaryMode && event.button === 0) {
    event.preventDefault();
    const point = screenToWorld(svg, event);
    moveBoundaryGesture = { pointerId: event.pointerId, document: documentModel, boundaryId: moveBoundaryMode.boundaryId, start: point };
    svg.setPointerCapture(event.pointerId);
    message = 'Move the complete deck area · release to place';
    updateStatusMessage();
    return;
  }
  if (blockingAddMode && event.button === 0) {
    event.preventDefault();
    const result = addManualBlockingRow(documentModel, blockingAddMode.fieldId, screenToWorld(svg, event));
    if (!result.row) {
      message = result.reason ?? 'Blocking row could not be placed there';
      updateStatusMessage();
      return;
    }
    blockingAddMode = null;
    selected = { kind: 'blocking', id: result.row.id };
    message = `${result.row.segments.length} manual blocking pieces added · Takeoff recalculated`;
    commit(result.document, 'Add manual Joist Blocking row');
    return;
  }
  if (blockingMoveMode && event.button === 0) {
    if (blockingRowId !== blockingMoveMode.rowId) {
      message = 'Drag the selected manual blocking row';
      updateStatusMessage();
      return;
    }
    event.preventDefault();
    blockingMoveGesture = { pointerId: event.pointerId, document: documentModel, rowId: blockingMoveMode.rowId, moved: false };
    svg.setPointerCapture(event.pointerId);
    message = 'Move manual blocking row · release inside the Joist Field';
    updateStatusMessage();
    return;
  }
  if (singleJoistMode && event.button === 0) {
    event.preventDefault();
    const targetDeck = boundaryById(singleJoistMode.boundaryId);
    const raw = screenToWorld(svg, event);
    if (!targetDeck) {
      singleJoistMode = null;
      message = 'The Joist Field Deck Boundary is no longer available';
      render();
      return;
    }
    const result = addParallelJoistToField(documentModel, singleJoistMode.fieldId, {
      boundary: targetDeck,
      supports: joistSupportsForBoundary(targetDeck),
      point: raw,
    });
    if (!result.joist) {
      message = result.reason ?? 'A supported joist could not be placed there';
      updateStatusMessage();
      return;
    }
    singleJoistMode = null;
    selected = { kind: 'framing', id: result.joist.id };
    activeBoundaryId = targetDeck.id;
    message = `Single parallel joist added · locked to this Joist Field · Takeoff recalculated`;
    commit(result.document, 'Add single parallel joist to field');
    return;
  }
  if (joistMeshMoveMode && event.button === 0) {
    const source = getJoists(documentModel).find((joist) => joist.id === framingId && joist.layout?.fieldId === joistMeshMoveMode.fieldId);
    if (!source) {
      message = 'Drag any joist in the highlighted field to reposition the mesh';
      updateStatusMessage();
      return;
    }
    event.preventDefault();
    const length = Math.hypot(source.end.x - source.start.x, source.end.y - source.start.y);
    const direction = { x: (source.end.x - source.start.x) / length, y: (source.end.y - source.start.y) / length };
    joistMeshMoveGesture = {
      pointerId: event.pointerId,
      document: documentModel,
      fieldId: joistMeshMoveMode.fieldId,
      boundaryId: joistMeshMoveMode.boundaryId,
      start: screenToWorld(svg, event),
      lateral: { x: -direction.y, y: direction.x },
      moved: false,
    };
    svg.setPointerCapture(event.pointerId);
    message = 'Move the complete Joist Field · release to place';
    updateStatusMessage();
    return;
  }
  activateBoundary(targetBoundaryId);
  if (blockingRowId && event.button === 0 && mode === 'select') {
    event.preventDefault();
    selected = { kind: 'blocking', id: blockingRowId };
    message = 'Joist Blocking row selected';
    render();
    return;
  }
  if (framingId && framingNode && event.button === 0 && mode === 'select') {
    const beam = getBeams(documentModel).find((entry) => entry.id === framingId);
    if (!beam) return;
    event.preventDefault();
    selected = { kind: 'framing', id: framingId };
    framingNodeGesture = { pointerId: event.pointerId, document: documentModel, beamId: framingId, endpoint: framingNode, moved: false };
    svg.setPointerCapture(event.pointerId);
    message = `Move Beam ${framingNode === 'start' ? 'start' : 'end'} · snap is active`;
    refreshContextPanel();
    updateStatusMessage();
    return;
  }
  if (framingId && event.button === 0 && mode === 'select') {
    event.preventDefault();
    selected = { kind: 'framing', id: framingId };
    message = 'Framing object selected';
    render();
    return;
  }
  if (mode === 'framing' && event.button === 0) {
    if (event.pointerType === 'touch' && activeTouches.size > 0) return;
    event.preventDefault();
    const raw = screenToWorld(svg, event);
    if (framingTool === 'joist') {
      if (!joistTargetBoundaryId) {
        if (!targetBoundaryId) {
          message = 'Touch the deck surface or its area label to select the Deck Boundary';
          updateStatusMessage();
          return;
        }
        joistTargetBoundaryId = targetBoundaryId;
        activateBoundary(targetBoundaryId);
        message = 'Deck Boundary selected · now press any reference line and drag perpendicular';
        render();
        return;
      }
      beginJoistField(svg, event, raw, edgeId, framingId, catObjectId);
    }
    else placeFramingPoint(raw, event.pointerType);
    return;
  }
  if (mode === 'cat' && event.button === 0) {
    event.preventDefault();
    placeCatPoint(screenToWorld(svg, event), event.pointerType, event, catObjectId);
    return;
  }
  if (boardingDirectionMode && event.button === 0) {
    event.preventDefault();
    const line = resolveBoardingReference({ edgeId, stairEdgeId, stairSideReferenceId, levelDownSegmentId, railingId });
    const target = boundaryById(boardingDirectionMode.boundaryId);
    if (!line || !target) {
      message = 'Touch a boundary, Stair, Level Down, or Railing line to set board direction';
      updateStatusMessage();
      return;
    }
    const updated = markBoundaryEdited(line.arc ? setDeckBoardingCurve(target, line.arc, line.reference) : setDeckBoardingDirection(target, line.start, line.end, line.reference));
    boardingDirectionMode = null;
    pendingDeckDeleteId = null;
    activeBoundaryId = target.id;
    selected = { kind: 'dimension', id: areaDimensionId(target) };
    message = line.arc ? 'Deck boards follow the selected curve as a concentric pattern' : 'Deck boards aligned to the selected construction line';
    commit(upsertObject(documentModel, updated), 'Set deck board direction');
    return;
  }
  if (chamferMode && event.button === 0) {
    event.preventDefault();
    chamferGesture = { pointerId: event.pointerId, document: documentModel, vertexId: chamferMode.vertexId };
    updateChamferDraft(screenToWorld(svg, event));
    svg.setPointerCapture(event.pointerId);
    return;
  }
  if (dimensionLeaderMode && event.button === 0) {
    event.preventDefault();
    const anchor = getDimensionObjectAnchor(dimensionLeaderMode.referenceId);
    if (!anchor) { dimensionLeaderMode = null; message = 'Dimension object is no longer available'; render(); return; }
    const point = screenToWorld(svg, event);
    dimensionLeaderGesture = { pointerId: event.pointerId, document: documentModel, referenceId: dimensionLeaderMode.referenceId, anchor };
    documentModel = setDimensionLeaderOffset(documentModel, dimensionLeaderMode.referenceId, { x: point.x - anchor.x, y: point.y - anchor.y });
    persist();
    svg.setPointerCapture(event.pointerId);
    drawCanvasRefresh();
    return;
  }
  if (event.pointerType === 'touch' && !['railing', 'level-down', 'cat', 'framing'].includes(mode) && !((mode === 'select' && (vertexId || edgeId || stairEdgeId || stairSideReferenceId || dimensionId || railingId || railingPostId || levelDownSegmentId || catObjectId || catBoundaryId || framingId)) || (mode === 'stair' && edgeId))) {
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
  if (mode === 'select' && dimensionId) {
    selected = { kind: 'dimension', id: dimensionId };
    dimensionDragStart = { pointerId: event.pointerId, document: documentModel, point: screenToWorld(svg, event), offset: getDimensionOffset(documentModel, dimensionId), moved: false };
    svg.setPointerCapture(event.pointerId);
    return;
  }
  if (mode === 'select' && catNoteId) {
    const note = getCatNotes(documentModel).find((entry) => entry.id === catNoteId);
    if (!note) return;
    selected = { kind: 'cat', id: catNoteId };
    catNoteDragStart = { pointerId: event.pointerId, document: documentModel, point: screenToWorld(svg, event), offset: note.labelOffset, moved: false };
    svg.setPointerCapture(event.pointerId);
    refreshContextPanel();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'select' && catObjectId) {
    selected = { kind: 'cat', id: catObjectId };
    message = 'CAT reference selected';
    render();
    return;
  }
  if (mode === 'select' && catBoundaryId) {
    selected = { kind: 'cat-boundary', id: catBoundaryId };
    message = 'Closed CAT Boundary selected · review area or convert to Deck Boundary';
    render();
    return;
  }
  if (mode === 'select' && railingPostId) {
    selected = { kind: 'railing-post', id: railingPostId };
    message = 'Railing post selected · Takeoff counts only visible posts';
    render();
    return;
  }
  if (mode === 'select' && railingId) {
    selected = { kind: 'railing', id: railingId };
    message = 'Railing run selected · hosted by construction geometry';
    render();
    return;
  }
  if (mode === 'select' && levelDownSegmentId) {
    selected = { kind: 'level-down', id: levelDownSegmentId };
    message = 'Level Down section selected · riser applies to the entire polyline';
    render();
    return;
  }
  if (mode === 'select' && stairEdgeId) {
    selected = { kind: 'stair-edge', id: stairEdgeId };
    message = 'Deck–Stair interface selected · assign construction properties';
    render();
    return;
  }
  if (mode === 'select' && stairSideReferenceId) {
    const reference = findStairSide(stairSideReferenceId);
    if (!reference) return;
    activateBoundary(reference.stair.host.boundaryId);
    selected = { kind: 'stair-side', id: stairSideReferenceId };
    const snapped = reference.side === 'start' ? reference.stair.dimensions.snappedStart : reference.stair.dimensions.snappedEnd;
    const originalDocument = documentModel;
    let editDocument = documentModel;
    const attachment = reference.stair.sideAttachments?.[reference.side];
    if (attachment?.junction) {
      const targetBoundary = boundaryById(attachment.boundaryId);
      if (targetBoundary) {
        const removed = removeStairSideJunction(targetBoundary, reference.stair, reference.side);
        const editableAttachment = {
          boundaryId: attachment.boundaryId,
          edgeId: attachment.junction.originalEdge.id,
          relationship: 'shared-boundary',
        };
        const editableStair = {
          ...removed.stair,
          sideAttachments: { ...removed.stair.sideAttachments, [reference.side]: editableAttachment },
        };
        editDocument = upsertObject(upsertObject(editDocument, removed.boundary), editableStair);
      }
    }
    stairSideGesture = { pointerId: event.pointerId, document: originalDocument, editDocument, stairId: reference.stair.id, side: reference.side, moved: false };
    svg.setPointerCapture(event.pointerId);
    message = snapped ? 'Drag sideways to detach this stair side from the node' : 'Drag sideways to change stair width · snaps within 6 inches';
    refreshContextPanel();
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (mode === 'select' && vertexId) {
    selected = { kind: 'vertex', id: vertexId };
    if (isVertexLocked(boundary(), vertexId)) { message = 'Node is locked in place'; render(); return; }
    const selectedVertex = boundary().vertices.find((vertex) => vertex.id === vertexId);
    if (selectedVertex?.junction?.type === 'stair-side') { message = 'This junction follows the connected stair side · drag the stair side to detach it'; render(); return; }
    const vertexIndex = boundary().vertices.findIndex((vertex) => vertex.id === vertexId);
    if ([boundary().edges[vertexIndex], boundary().edges[(vertexIndex - 1 + boundary().edges.length) % boundary().edges.length]].some((edge) => isEdgeLocked(boundary(), edge.id))) { message = 'A connected construction edge is locked'; render(); return; }
    draggingVertexId = vertexId;
    dragStartDocument = documentModel;
    mergeCandidateId = null;
    svg.setPointerCapture(event.pointerId);
    refreshContextPanel();
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (mode === 'select' && edgeId) {
    selected = { kind: 'edge', id: edgeId };
    if (isEdgeLocked(boundary(), edgeId)) { message = 'Construction edge is locked'; render(); return; }
    const edgeIndex = boundary().edges.findIndex((edge) => edge.id === edgeId);
    const endpointLocked = [boundary().vertices[edgeIndex], boundary().vertices[(edgeIndex + 1) % boundary().vertices.length]].some((vertex) => vertex?.locked);
    const neighborLocked = [boundary().edges[(edgeIndex - 1 + boundary().edges.length) % boundary().edges.length], boundary().edges[(edgeIndex + 1) % boundary().edges.length]].some((edge) => isEdgeLocked(boundary(), edge.id));
    if (endpointLocked || neighborLocked) { message = 'Unlock connected nodes and edges before moving this construction edge'; render(); return; }
    draggingEdgeId = edgeId;
    edgeDragStart = { document: documentModel, boundary: boundary(), point: screenToWorld(svg, event), moved: false };
    svg.setPointerCapture(event.pointerId);
    refreshContextPanel();
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (mode === 'stair' && edgeId) {
    const pointer = screenToWorld(svg, event);
    const clicked = boundary();
    const worldPerPixel = viewport.width / Math.max(svg.clientWidth, 1);
    const host = resolveStairHostEdge(clicked, edgeId, boundaries(), pointer, Math.max(1, worldPerPixel * 8));
    const current = host?.boundary ?? clicked;
    const hostEdgeId = host?.edgeId ?? edgeId;
    activateBoundary(current.id);
    if (isEdgeLocked(current, hostEdgeId)) { message = 'Unlock this construction edge before attaching a staircase'; updateStatusMessage(); return; }
    const edgeIndex = current.edges.findIndex((edge) => edge.id === hostEdgeId);
    const edgeLength = Math.hypot(
      current.vertices[(edgeIndex + 1) % current.vertices.length].x - current.vertices[edgeIndex].x,
      current.vertices[(edgeIndex + 1) % current.vertices.length].y - current.vertices[edgeIndex].y,
    );
    const opening = deriveStairOpeningSnap(current, hostEdgeId, pointer, Math.min(36, edgeLength));
    if (!opening) { message = 'Select a construction edge at least 24 inches long'; updateStatusMessage(); return; }
    selected = { kind: 'edge', id: hostEdgeId };
    stairGesture = { pointerId: event.pointerId, boundaryId: current.id, edgeId: hostEdgeId, ...opening };
    stairDraft = { edgeId: hostEdgeId, ...opening, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0, dragging: true };
    const stairSnapLabel = opening.snappedStart && opening.snappedEnd ? 'Both stair sides snapped to adjacent nodes' : opening.snappedStart || opening.snappedEnd ? 'One stair side snapped to an adjacent node' : 'Stair opening placed';
    const levelMessage = host && host.boundary.id !== clicked.id ? 'Upper shared edge selected automatically' : stairSnapLabel;
    message = `${levelMessage} · drag toward the lower deck`;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('stairing');
    updateStairLiveHud();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'railing') {
    const startAnchor = resolveRailingSnap(screenToWorld(svg, event));
    if (!startAnchor) {
      message = 'Enable Edge or Grid snap, then begin on an active snap target';
      updateStatusMessage();
      return;
    }
    railingGesture = { pointerId: event.pointerId, startAnchor };
    railingDraft = { startAnchor, endAnchor: null, geometry: null };
    message = `${startAnchor.label} locked · drag to another snap target`;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('railing');
    drawCanvasRefresh();
    return;
  }
  if (mode === 'level-down') {
    placeLevelDownPoint(screenToWorld(svg, event));
    return;
  }
  if (mode !== 'draw') { selected = { kind: null, id: null }; render(); return; }
  placeDraftPoint(screenToWorld(svg, event), event.pointerType);
}

function placeDraftPoint(raw, pointerType = 'mouse') {
  const snapped = snapForPointer(raw, draft[draft.length - 1], [], new Set(), pointerType);
  if (draft.length >= 3 && Math.hypot(snapped.point.x - draft[0].x, snapped.point.y - draft[0].y) < 5) { completeDraft(); return; }
  draft.push(snapped.point);
  numericBuffer = '';
  const alignedToStart = snapped.referenceId === 'active-boundary-draft:node:0' && ['node-inference', 'node-intersection'].includes(snapped.type);
  message = draft.length < 3 ? 'Continue to the next corner' : alignedToStart ? 'Ortho aligned to first corner · click the first corner to close' : 'Click the first corner or press Enter to close';
  render();
}

function catCuttingSegments(excludedLineId = null) {
  const boundarySegments = boundaries().flatMap((deck) => deck.edges.map((edge, index) => ({
    id: edge.id,
    start: deck.vertices[index],
    end: deck.vertices[(index + 1) % deck.vertices.length],
  })));
  const catSegments = getCatLines(documentModel).filter((line) => line.id !== excludedLineId);
  return [...boundarySegments, ...catSegments];
}

function snapJoistFieldOrigin(projected, hostStart, hostEnd, tolerance) {
  const candidates = getJoists(documentModel).flatMap((joist) => [joist.start, joist.end])
    .map((endpoint) => ({ endpoint, onHost: nearestPointOnSegment(endpoint, hostStart, hostEnd).point }))
    .filter((entry) => Math.hypot(entry.endpoint.x - entry.onHost.x, entry.endpoint.y - entry.onHost.y) <= 1)
    .sort((a, b) => Math.hypot(a.onHost.x - projected.x, a.onHost.y - projected.y) - Math.hypot(b.onHost.x - projected.x, b.onHost.y - projected.y));
  const nearest = candidates[0];
  return nearest && Math.hypot(nearest.onHost.x - projected.x, nearest.onHost.y - projected.y) <= tolerance ? nearest.onHost : projected;
}

function resolveJoistReference(raw, edgeId = null, framingId = null, catObjectId = null, tolerance = 1) {
  if (framingId) {
    const member = documentModel.objects.find((entry) => entry.id === framingId && ['beam', 'joist'].includes(entry.type));
    if (!member) return null;
    return {
      start: member.start,
      end: member.end,
      origin: snapJoistFieldOrigin(nearestPointOnSegment(raw, member.start, member.end).point, member.start, member.end, tolerance),
      reference: { type: member.type, id: member.id },
      label: member.type === 'beam' ? 'Beam reference' : 'Joist reference',
    };
  }
  if (catObjectId) {
    const line = getCatLines(documentModel).find((entry) => entry.id === catObjectId);
    if (line) {
      const [start, end] = line.vertices;
      return { start, end, origin: nearestPointOnSegment(raw, start, end).point, reference: { type: 'cat-line', id: line.id }, label: 'CAT line reference' };
    }
  }
  if (edgeId) {
    const sourceDeck = boundaryForReference(edgeId);
    const edge = sourceDeck?.edges.find((entry) => entry.id === edgeId);
    const byId = new Map((sourceDeck?.vertices ?? []).map((vertex) => [vertex.id, vertex]));
    const start = edge ? byId.get(edge.startVertexId) : null;
    const end = edge ? byId.get(edge.endVertexId) : null;
    if (start && end) return { start, end, origin: nearestPointOnSegment(raw, start, end).point, reference: { type: 'boundary-edge', id: edge.id }, label: 'Boundary line reference' };
  }
  return null;
}

function joistSupportsForBoundary(deck) {
  const byId = new Map(deck.vertices.map((vertex) => [vertex.id, vertex]));
  const ledgerSupports = deck.edges.flatMap((edge) => {
    const normalized = normalizeBoundaryEdge(edge);
    const house = edge.role === 'house' || normalized.properties.classification.relationship === 'house-attachment';
    const ledger = house && normalized.properties.attachments.ledger !== false;
    const start = byId.get(edge.startVertexId);
    const end = byId.get(edge.endVertexId);
    return ledger && start && end ? [{ id: edge.id, type: 'ledger', ownerId: edge.id, sourceBoundaryId: deck.id, targetBoundaryId: deck.id, start, end }] : [];
  });
  const rimSupports = deriveSharedRimFlushSupports(boundaries(), deck);
  const beamSupports = getBeams(documentModel).flatMap((beam) => clipLinearMemberToPolygon(beam.start, beam.end, deck.vertices)
    .map((segment, index) => ({ id: `${beam.id}:${index}`, ownerId: beam.id, type: 'beam', start: segment.start, end: segment.end })));
  return [...ledgerSupports, ...rimSupports, ...beamSupports];
}

function beginJoistField(svg, event, raw, edgeId, framingId, catObjectId) {
  const targetDeck = boundaryById(joistTargetBoundaryId);
  if (!targetDeck) {
    message = 'Select the Deck Boundary to fill first';
    updateStatusMessage();
    return;
  }
  const tolerance = viewport.width / Math.max(svg.clientWidth || 1000, 1) * 14;
  const reference = resolveJoistReference(raw, edgeId, framingId, catObjectId, tolerance);
  if (!reference) {
    message = 'Select a Boundary, Beam, Joist, or CAT line as the layout reference';
    updateStatusMessage();
    return;
  }
  framingGesture = { pointerId: event.pointerId, host: { ...reference, boundary: targetDeck, supports: joistSupportsForBoundary(targetDeck) }, document: documentModel };
  framingDraft = { kind: 'joist-field', field: { joists: [], needsReviewCount: 0 } };
  pointerWorld = reference.origin;
  svg.setPointerCapture(event.pointerId);
  message = `${reference.label} selected · drag perpendicular to preview the complete DB`;
  drawCanvasRefresh();
  updateStatusMessage();
}

function placeFramingPoint(raw, pointerType = 'mouse') {
  const snapped = snapForPointer(raw, framingDraft?.start ?? null, [], new Set(), pointerType);
  const point = snapped.point;
  if (framingTool === 'post') {
    const object = createPost({ at: point });
    selected = { kind: 'framing', id: object.id };
    message = 'Post / Footing placed · post base and concrete included in Takeoff';
    commit(addPost(documentModel, object), 'Place Post / Footing assembly');
    return;
  }
  if (!framingDraft) {
    framingDraft = { start: point };
    pointerWorld = point;
    message = 'Choose the far endpoint';
    render();
    return;
  }
  const start = framingDraft.start;
  framingDraft = null;
  pointerWorld = null;
  if (Math.hypot(point.x - start.x, point.y - start.y) < 1) { message = 'That framing run is too short'; render(); return; }
  try {
    const object = framingTool === 'beam' ? createBeam({ start, end: point }) : createJoist({ start, end: point });
    selected = { kind: 'framing', id: object.id };
    message = framingTool === 'beam' ? 'Beam placed · posts and footings derived live' : `Joist placed · Repeat uses ${framingSpacing}″ O.C.`;
    commit(framingTool === 'beam' ? addBeam(documentModel, object) : addJoist(documentModel, object), framingTool === 'beam' ? 'Place beam' : 'Place joist');
  } catch (error) { message = error.message; render(); }
}

function placeCatPoint(raw, pointerType = 'mouse', pointerEvent = null, targetCatObjectId = null) {
  if (catTool === 'offset') {
    if (!catDraft?.sourceLineId) {
      const line = getCatLines(documentModel).find((entry) => entry.id === targetCatObjectId);
      if (!line) { message = 'Offset · choose a CAT Line or arc'; updateStatusMessage(); return; }
      catDraft = { sourceLineId: line.id }; catPointer = raw; numericBuffer = ''; message = `${lastCatOffsetDistance ? `Repeat ${formatFeetInches(lastCatOffsetDistance)} Offset` : 'Offset'} · move to the desired side${lastCatOffsetDistance ? '' : ' and distance'}`; render(); return;
    }
    const source = getCatLines(documentModel).find((entry) => entry.id === catDraft.sourceLineId);
    if (!source) { catDraft = null; return; }
    try {
      const exact = numericBuffer ? parseConstructionLength(numericBuffer) : lastCatOffsetDistance;
      if (numericBuffer && (!exact || exact <= 0)) throw new Error('Use an Offset such as 6in, 2ft, or 500mm.');
      const result = applyCatOffset(documentModel, source.id, raw, { ...(exact ? { distanceInches: exact } : {}) });
      lastCatOffsetDistance = result.distanceInches; catDraft = null; catPointer = null; numericBuffer = ''; selected = { kind: 'cat', id: result.line.id };
      message = `${deriveCatLineGeometry(result.line).kind === 'arc' ? 'Concentric arc' : 'Parallel line'} offset ${formatFeetInches(lastCatOffsetDistance)} · Repeat Offset ready`;
      commit(result.document, 'Offset CAT construction line');
    } catch (error) { message = error.message; render(); }
    return;
  }
  if (catTool === 'trim') {
    const line = getCatLines(documentModel).find((entry) => entry.id === targetCatObjectId);
    if (!line) { message = 'Choose a CAT Line or arc to Trim'; updateStatusMessage(); return; }
    try {
      const updated = trimCatLine(line, raw, catCuttingSegments(line.id));
      selected = { kind: 'cat', id: line.id };
      message = `${deriveCatLineGeometry(line).kind === 'arc' ? 'CAT arc' : 'CAT Line'} trimmed to the nearest crossing`;
      commit(upsertObject(documentModel, updated), 'Trim CAT construction line');
    } catch (error) { message = error.message; render(); }
    return;
  }
  if (catTool === 'extend') {
    const line = getCatLines(documentModel).find((entry) => entry.id === targetCatObjectId);
    if (!line) { message = catDraft?.extendSourceId ? 'Select the second CAT Line as the intersection reference' : 'Select the CAT Line or arc to extend'; updateStatusMessage(); return; }
    if (!catDraft?.extendSourceId) {
      catDraft = { extendSourceId: line.id, extendClickPoint: { x: Number(raw.x), y: Number(raw.y) } };
      selected = { kind: 'cat', id: line.id };
      message = 'Extend to line intersection · select the second CAT Line'; render(); return;
    }
    const source = getCatLines(documentModel).find((entry) => entry.id === catDraft.extendSourceId);
    if (!source) { catDraft = null; render(); return; }
    try {
      const updated = extendCatLineToLine(source, line, catDraft.extendClickPoint);
      catDraft = null; selected = { kind: 'cat', id: source.id };
      message = `${deriveCatLineGeometry(source).kind === 'arc' ? 'CAT arc extended along its circumference' : 'CAT Line extended'} to the selected line intersection`;
      commit(upsertObject(documentModel, updated), 'Extend CAT construction line to selected intersection');
    } catch (error) { message = error.message; render(); }
    return;
  }
  if (catTool === 'note') {
    const note = createCatNote(raw, '');
    mode = 'select';
    selected = { kind: 'cat', id: note.id };
    message = 'Arrow point placed · write the note in Object properties';
    commit(upsertObject(documentModel, note), 'Add CAT construction note');
    requestAnimationFrame(() => app.querySelector('#cat-note-text')?.focus());
    return;
  }
  const snapped = snapForPointer(raw, catDraft?.start ?? null, [], new Set(), pointerType);
  catSnapState = snapped;
  if (!catDraft?.start) {
    catDraft = { start: snapped.point };
    catPointer = snapped.point;
    numericBuffer = '';
    message = `${snapped.label} · choose the second point`;
    render();
    if (pointerEvent && catTool === 'line') requestAnimationFrame(() => updateHud(pointerEvent));
    return;
  }
  try {
    const object = catTool === 'measure'
      ? createCatMeasurement(catDraft.start, snapped.point)
      : createCatLine(catDraft.start, snapped.point);
    message = catTool === 'measure'
      ? `${formatFeetInches(deriveCatMeasurement(object).pointToPointDistance)} point-to-point measurement added`
      : `${formatFeetInches(Math.hypot(snapped.point.x - catDraft.start.x, snapped.point.y - catDraft.start.y))} CAT line added · continue or press Escape`;
    catDraft = catTool === 'line' ? { start: snapped.point } : null;
    catPointer = catTool === 'line' ? snapped.point : null;
    numericBuffer = '';
    commit(upsertObject(documentModel, object), catTool === 'measure' ? 'Add CAT measuring tape' : 'Add CAT construction line');
    if (pointerEvent && catTool === 'line') requestAnimationFrame(() => updateHud(pointerEvent));
  } catch (error) {
    message = error.message;
    render();
  }
}

function updateChamferDraft(raw) {
  const source = chamferGesture?.document.objects.find((object) => object.type === 'deck-boundary');
  const corner = source?.vertices.find((vertex) => vertex.id === chamferGesture?.vertexId);
  if (!source || !corner) return;
  const index = source.vertices.findIndex((vertex) => vertex.id === corner.id);
  const previous = source.vertices[(index - 1 + source.vertices.length) % source.vertices.length];
  const next = source.vertices[(index + 1) % source.vertices.length];
  const maximum = Math.min(Math.hypot(previous.x - corner.x, previous.y - corner.y), Math.hypot(next.x - corner.x, next.y - corner.y)) - 6;
  const requested = Math.hypot(raw.x - corner.x, raw.y - corner.y);
  const setback = Math.max(6, Math.min(maximum, Math.round(requested * 2) / 2));
  if (maximum < 6) { message = 'Connected edges are too short for a chamfer'; updateStatusMessage(); return; }
  try {
    chamferDraft = { ...chamferVertex(source, corner.id, setback), originalCorner: { x: corner.x, y: corner.y } };
    message = `45° chamfer · ${formatInches(setback)} setback · release to apply`;
    drawCanvasRefresh();
    updateStatusMessage();
  } catch (error) { chamferDraft = null; message = error.message; updateStatusMessage(); }
}

function placeLevelDownPoint(raw) {
  const anchor = resolveRailingSnap(raw);
  if (!anchor) { message = 'Choose an enabled edge, corner, or grid snap'; updateStatusMessage(); return; }
  const boundaryAnchor = ['edge', 'vertex'].includes(anchor.snapType) && anchor.edgeKind !== 'stair-interface-edge';
  if (!levelDownDraft.length && !boundaryAnchor) {
    message = 'Level Down must begin on the Deck Boundary'; updateStatusMessage(); return;
  }
  if (!levelDownDraft.length && anchor.boundaryId) activateBoundary(anchor.boundaryId);
  if (levelDownDraft.length && boundaryAnchor && anchor.boundaryId !== levelDownDraft[0].anchor?.boundaryId) {
    message = 'Finish Level Down on the same Deck Boundary where it started'; updateStatusMessage(); return;
  }
  const previous = levelDownDraft.at(-1)?.point;
  if (previous && Math.hypot(anchor.point.x - previous.x, anchor.point.y - previous.y) < 1) return;
  if (levelDownDraft.length && boundaryAnchor) {
    const points = [...levelDownDraft, anchor].map((entry) => ({ x: entry.point.x, y: entry.point.y, anchor: entry }));
    try {
      const levelDown = createLevelDown(points, { boundaryId: boundary().id });
      selected = { kind: 'level-down', id: levelDown.segments[0].id };
      levelDownDraft = [];
      levelDownPointer = null;
      mode = 'select';
      message = `${levelDown.segments.length} Level Down section${levelDown.segments.length === 1 ? '' : 's'} added · 7½″ riser`;
      commit(upsertObject(documentModel, levelDown), 'Add Level Down construction polyline');
    } catch (error) { message = error.message; render(); }
    return;
  }
  levelDownDraft.push(anchor);
  levelDownPointer = anchor;
  message = levelDownDraft.length === 1 ? 'Start locked · add intermediate points or finish on another boundary edge' : 'Polyline point added · finish on a boundary edge';
  drawCanvasRefresh();
  updateStatusMessage();
}

function canvasPointerMove(svg, event) {
  if (catArchGesture?.pointerId === event.pointerId) {
    try { catArchDraft = dragCatLineArc(catArchGesture.line, screenToWorld(svg, event)); message = 'CAT Arch line · release to apply'; }
    catch (error) { catArchDraft = null; message = error.message; }
    drawCanvasRefresh(); updateStatusMessage(); return;
  }
  if (archGesture?.pointerId === event.pointerId) {
    try {
      archDraft = dragArchLine(archGesture.boundary, archMode.edgeId, screenToWorld(svg, event));
      message = 'Arch line · release to apply · Esc to cancel';
    } catch (error) { archDraft = null; message = error.message; }
    drawCanvasRefresh(); updateStatusMessage(); return;
  }
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
  if (blockingMoveGesture?.pointerId === event.pointerId) {
    const gesture = blockingMoveGesture;
    const result = moveManualBlockingRow(gesture.document, gesture.rowId, raw);
    if (!result.row) {
      message = result.reason ?? 'Keep the blocking row inside the Joist Field';
      updateStatusMessage();
      return;
    }
    documentModel = result.document;
    gesture.moved = true;
    message = `${result.row.segments.length} blocking pieces · Takeoff recalculated`;
    persist();
    drawCanvasRefresh();
    refreshContextPanel();
    updateStatusMessage();
    return;
  }
  if (joistMeshMoveGesture?.pointerId === event.pointerId) {
    const gesture = joistMeshMoveGesture;
    const targetDeck = gesture.document.objects.find((object) => object.type === 'deck-boundary' && object.id === gesture.boundaryId);
    if (!targetDeck) return;
    const dx = raw.x - gesture.start.x;
    const dy = raw.y - gesture.start.y;
    const offsetInches = dx * gesture.lateral.x + dy * gesture.lateral.y;
    const result = moveJoistField(gesture.document, gesture.fieldId, {
      boundary: targetDeck,
      supports: joistSupportsForBoundary(targetDeck),
      offsetInches,
    });
    if (!result.changed) return;
    documentModel = result.document;
    gesture.moved ||= Math.abs(offsetInches) > viewport.width / Math.max(svg.clientWidth, 1) * 2;
    if (!result.joists.some((joist) => joist.id === selected.id)) selected = { kind: 'framing', id: result.joists[0]?.id ?? null };
    message = `${result.joists.length} joists repositioned · clipped to DB · Takeoff recalculated`;
    persist();
    drawCanvasRefresh();
    refreshContextPanel();
    updateStatusMessage();
    return;
  }
  if (framingNodeGesture?.pointerId === event.pointerId) {
    const source = framingNodeGesture.document.objects.find((object) => object.type === 'beam' && object.id === framingNodeGesture.beamId);
    if (!source) return;
    const opposite = framingNodeGesture.endpoint === 'start' ? source.end : source.start;
    const snapped = snapForPointer(raw, opposite, [], new Set([source.id]), event.pointerType);
    try {
      documentModel = updateBeam(framingNodeGesture.document, source.id, { [framingNodeGesture.endpoint]: snapped.point });
      framingNodeGesture.moved = true;
      const edited = getBeams(documentModel).find((beam) => beam.id === source.id);
      const stock = planBeamStock(edited.computed.lengthInches);
      message = `${formatFeetInches(edited.computed.lengthInches)} Beam · ${stock.byLength.map((entry) => `${entry.quantity}×${entry.lengthFeet}′`).join(' + ')} · ${snapped.label}`;
      persist();
      drawCanvasRefresh();
      refreshContextPanel();
      updateStatusMessage();
    } catch (error) {
      message = error.message;
      updateStatusMessage();
    }
    return;
  }
  if (catNoteDragStart?.pointerId === event.pointerId) {
    const note = catNoteDragStart.document.objects.find((object) => object.type === CAT_NOTE_TYPE && object.id === selected.id);
    if (!note) return;
    const dx = raw.x - catNoteDragStart.point.x;
    const dy = raw.y - catNoteDragStart.point.y;
    catNoteDragStart.moved ||= Math.hypot(dx, dy) > viewport.width / Math.max(svg.clientWidth, 1) * 2;
    const updated = updateCatNote(note, { labelOffset: { x: catNoteDragStart.offset.x + dx, y: catNoteDragStart.offset.y + dy } });
    documentModel = upsertObject(catNoteDragStart.document, updated);
    persist();
    drawCanvasRefresh();
    return;
  }
  if (framingGesture?.pointerId === event.pointerId) {
    const { host } = framingGesture;
    const field = deriveJoistField({
      boundary: host.boundary,
      hostStart: host.start,
      hostEnd: host.end,
      origin: host.origin,
      toward: raw,
      spacingInches: framingSpacing,
      size: '2×6 PT',
      host: host.reference,
      fillBoundary: true,
      supports: host.supports,
    });
    framingDraft = { kind: 'joist-field', field: field ?? { joists: [], needsReviewCount: 0 } };
    pointerWorld = raw;
    const count = framingDraft.field.joists.filter((joist) => joist.supported).length;
    const review = framingDraft.field.needsReviewCount ? ` · ${framingDraft.field.needsReviewCount} commercial/span REVIEW` : '';
    const unsupported = framingDraft.field.unsupportedCount ? ` · ${framingDraft.field.unsupportedCount} unsupported lines shown red` : '';
    message = count ? `${count} supported joists · ${framingSpacing}″ O.C. · release to establish${review}${unsupported}` : unsupported ? 'No valid supported bays · add or assign Ledger, Beam, and Rim / Flush supports' : 'Drag perpendicular at least 1 inch';
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (mode === 'framing' && framingDraft?.start) {
    snapState = snapForPointer(raw, framingDraft.start, [], new Set(), event.pointerType);
    pointerWorld = snapState.point;
    message = `${snapState.label} · click to place ${framingTool}`;
    drawCanvasRefresh();
    updateHud(event);
    updateStatusMessage();
    return;
  }
  if (mode === 'cat' && catTool === 'offset' && catDraft?.sourceLineId) {
    catPointer = raw;
    message = 'Offset preview · click to place the parallel CAT Line';
    drawCanvasRefresh(); updateHud(event); updateStatusMessage(); return;
  }
  if (mode === 'cat' && catDraft?.start) {
    catSnapState = snapForPointer(raw, catDraft.start, [], new Set(), event.pointerType);
    catPointer = catSnapState.point;
    message = `${catSnapState.label} · ${catTool === 'measure' ? 'horizontal, vertical, and point-to-point preview' : 'click to place CAT line'}`;
    drawCanvasRefresh();
    if (catTool === 'line') updateHud(event);
    else hideHud();
    updateStatusMessage();
    return;
  }
  if (moveBoundaryGesture?.pointerId === event.pointerId) {
    try {
      documentModel = translateDeckAssembly(moveBoundaryGesture.document, moveBoundaryGesture.boundaryId, { x: raw.x - moveBoundaryGesture.start.x, y: raw.y - moveBoundaryGesture.start.y });
      persist();
      drawCanvasRefresh();
    } catch (error) { message = error.message; updateStatusMessage(); }
    return;
  }
  if (chamferGesture?.pointerId === event.pointerId) {
    updateChamferDraft(raw);
    return;
  }
  if (dimensionLeaderGesture?.pointerId === event.pointerId) {
    documentModel = setDimensionLeaderOffset(dimensionLeaderGesture.document, dimensionLeaderGesture.referenceId, { x: raw.x - dimensionLeaderGesture.anchor.x, y: raw.y - dimensionLeaderGesture.anchor.y });
    persist();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'level-down') {
    levelDownPointer = resolveRailingSnap(raw);
    message = levelDownPointer ? `${levelDownPointer.label}${levelDownDraft.length ? ' · click to add or finish' : ' · click to start'}` : 'Move to an enabled snap target';
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (dimensionDragStart?.pointerId === event.pointerId) {
    const dx = raw.x - dimensionDragStart.point.x;
    const dy = raw.y - dimensionDragStart.point.y;
    const moved = Math.hypot(dx, dy) > viewport.width / Math.max(svg.clientWidth, 1) * 2;
    dimensionDragStart.moved ||= moved;
    documentModel = setDimensionOffset(dimensionDragStart.document, selected.id, { x: dimensionDragStart.offset.x + dx, y: dimensionDragStart.offset.y + dy });
    persist();
    drawCanvasRefresh();
    return;
  }
  if (railingGesture?.pointerId === event.pointerId) {
    const endAnchor = resolveRailingSnap(raw);
    if (!endAnchor) {
      railingDraft = { startAnchor: railingGesture.startAnchor, endAnchor: null, geometry: null };
      message = 'Move to an enabled edge, corner, or grid snap';
      drawCanvasRefresh();
      updateStatusMessage();
      return;
    }
    const temporary = {
      type: 'railing-run',
      id: 'railing-preview',
      name: 'Railing preview',
      anchors: { start: railingGesture.startAnchor, end: endAnchor },
      settings: { maxClearSpan: 72, postWidth: 3.5 },
    };
    const geometry = deriveRailingLineGeometry(temporary, railingGesture.startAnchor.point, endAnchor.point);
    railingDraft = { startAnchor: railingGesture.startAnchor, endAnchor, geometry };
    message = `${formatFeetInches(geometry.length)} · ${geometry.sectionCount} sections · ${endAnchor.label}`;
    drawCanvasRefresh();
    updateStatusMessage();
    return;
  }
  if (stairGesture?.pointerId === event.pointerId) {
    const current = boundaryById(stairGesture.boundaryId) ?? boundary();
    let options = deriveStairDragOptions(current, stairGesture.edgeId, raw, stairGesture.width, stairGesture.startOffset);
    const connection = options ? findStairBoundaryConnection(current, stairGesture.edgeId, stairGesture, boundaries(), raw, viewport.width / Math.max(svg.clientWidth, 1) * 20) : null;
    options = mergeStairBoundaryConnection(options, connection, stairGesture.edgeId);
    stairDraft = options
      ? { edgeId: stairGesture.edgeId, ...stairGesture, ...options, dragging: true }
      : { edgeId: stairGesture.edgeId, ...stairGesture, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0, dragging: true };
    const stairSnapLabel = stairGesture.snappedStart && stairGesture.snappedEnd ? 'both sides snapped' : stairGesture.snappedStart || stairGesture.snappedEnd ? 'one side snapped' : 'free opening';
    message = options ? connection ? `${formatFeetInches(options.totalRise, .25)} rise · valid landing inside lower deck · release to build` : `${formatFeetInches(options.totalRise, .25)} total rise · ${stairSnapLabel} · release to build` : 'Drag outward from the deck edge';
    drawCanvasRefresh();
    updateStairLiveHud(event);
    updateStatusMessage();
    return;
  }
  if (stairSideGesture?.pointerId === event.pointerId) {
    const gesture = stairSideGesture;
    const sourceBoundary = gesture.editDocument.objects.find((object) => object.type === 'deck-boundary' && object.id === activeBoundaryId);
    const sourceStair = gesture.editDocument.objects.find((object) => object.type === 'stair' && object.id === gesture.stairId);
    if (!sourceBoundary || !sourceStair) return;
    try {
      const snapBoundaries = gesture.editDocument.objects.filter((object) => object.type === 'deck-boundary');
      const resized = setStairSidePosition(sourceBoundary, sourceStair, gesture.side, raw, snapBoundaries);
      let next = resized.boundary === sourceBoundary ? gesture.editDocument : upsertObject(gesture.editDocument, markBoundaryEdited(resized.boundary));
      next = upsertObject(next, resized.stair);
      documentModel = next;
      gesture.moved = true;
      const snapLabel = resized.detachedFromNode
        ? ' · side detached from node'
        : resized.detachedFromBoundary
          ? ' · side detached from boundary'
          : resized.snap?.type === 'edge'
            ? ' · side snapped to boundary edge'
            : resized.snap?.type === 'node'
              ? ' · side snapped to node'
              : '';
      message = `${formatFeetInches(resized.stair.dimensions.width)} stair width${snapLabel}`;
      persist();
      drawCanvasRefresh();
      refreshContextPanel();
      updateStatusMessage();
    } catch (error) {
      message = error.message;
      updateStatusMessage();
    }
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
    try {
      const moved = offsetEdge(original, draggingEdgeId, offset);
      documentModel = upsertObject(edgeDragStart.document, moved);
      persist();
      drawCanvasRefresh();
    } catch (error) {
      message = error.message;
      updateStatusMessage();
    }
    return;
  }
  if (draggingVertexId && boundary()) {
    const current = boundary();
    const index = current.vertices.findIndex((vertex) => vertex.id === draggingVertexId);
    const anchor = current.vertices[(index - 1 + current.vertices.length) % current.vertices.length];
    const adjacentIds = new Set([draggingVertexId, current.edges[index]?.id, current.edges[(index - 1 + current.edges.length) % current.edges.length]?.id]);
    const snapped = snapForPointer(raw, anchor, [], adjacentIds, event.pointerType);
    const constrainedBoundary = moveVertexWithConstraints(current, draggingVertexId, snapped.point);
    const constrainedPoint = constrainedBoundary.vertices[index];
    const tolerance = viewport.width / Math.max(svg.clientWidth, 1) * 14;
    mergeCandidateId = findAdjacentMergeCandidate(current, draggingVertexId, constrainedPoint, tolerance)?.id ?? null;
    if (mergeCandidateId) message = 'Release to merge neighboring corners';
    documentModel = upsertObject(documentModel, constrainedBoundary);
    persist();
    drawCanvasRefresh();
    return;
  }
  if (mode === 'draw') {
    snapState = snapForPointer(raw, draft[draft.length - 1], [], new Set(), event.pointerType);
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
  if (catArchGesture?.pointerId === event.pointerId) {
    const next = catArchDraft; catArchGesture = null; catArchDraft = null; catArchMode = null;
    if (event.type !== 'pointercancel' && next) { message = 'CAT Arch line updated'; commit(upsertObject(documentModel, next), 'Curve CAT construction line'); }
    else { message = 'CAT Arch line canceled'; render(); }
    return;
  }
  if (archGesture?.pointerId === event.pointerId) {
    const next = archDraft;
    archGesture = null; archDraft = null; archMode = null;
    if (event.type !== 'pointercancel' && next) {
      try { commitArchBoundary(next); message = 'Arch line updated'; } catch (error) { message = error.message; render(); }
    } else { message = 'Arch line canceled'; render(); }
    return;
  }
  if (event.pointerType === 'touch') {
    const shouldPlace = pendingTouch?.pointerId === event.pointerId && !pendingTouch.moved && !touchGesture;
    const placement = pendingTouch ? { clientX: pendingTouch.x, clientY: pendingTouch.y } : null;
    activeTouches.delete(event.pointerId);
    if (pendingTouch?.pointerId === event.pointerId) pendingTouch = null;
    if (activeTouches.size < 2) touchGesture = null;
    if (shouldPlace && placement) placeDraftPoint(screenToWorld(svg, placement), 'touch');
  }
  if (panGesture) {
    panGesture = null;
    app.querySelector('.model-canvas')?.classList.remove('panning');
  }
  if (blockingMoveGesture?.pointerId === event.pointerId) {
    const gesture = blockingMoveGesture;
    const finalDocument = documentModel;
    blockingMoveGesture = null;
    blockingMoveMode = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') {
      message = 'Blocking row move canceled';
      persist();
      render();
    } else if (gesture.moved) {
      message = 'Manual blocking row repositioned · Takeoff recalculated';
      commit(finalDocument, 'Move manual Joist Blocking row');
    } else {
      documentModel = finalDocument;
      render();
    }
    return;
  }
  if (joistMeshMoveGesture?.pointerId === event.pointerId) {
    const gesture = joistMeshMoveGesture;
    const finalDocument = documentModel;
    joistMeshMoveGesture = null;
    joistMeshMoveMode = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') {
      message = 'Joist Field move canceled';
      persist();
      render();
    } else if (gesture.moved) {
      message = 'Joist Field repositioned · single joists stayed locked · Takeoff recalculated';
      commit(finalDocument, 'Move complete Joist Field mesh');
    } else {
      documentModel = finalDocument;
      message = 'Joist Field unchanged';
      persist();
      render();
    }
    return;
  }
  if (framingGesture?.pointerId === event.pointerId) {
    const gesture = framingGesture;
    const field = framingDraft?.kind === 'joist-field' ? framingDraft.field : null;
    framingGesture = null;
    framingDraft = null;
    pointerWorld = null;
    const supportedJoists = field?.joists?.filter((joist) => joist.supported) ?? [];
    if (event.type === 'pointercancel' || !supportedJoists.length) {
      message = event.type === 'pointercancel' ? 'Joist field canceled' : 'No supported joist bays were found in the selected Deck Boundary';
      render();
      return;
    }
    const fieldId = `joist-field-${crypto.randomUUID()}`;
    let next = gesture.document;
    const established = supportedJoists.map((entry) => createJoist({
      start: entry.start,
      end: entry.end,
      size: entry.size,
      layout: { ...entry.layout, fieldId },
    }));
    established.forEach((joist) => { next = addJoist(next, joist); });
    selected = { kind: 'framing', id: established[0].id };
    message = `${established.length} continuous joist runs established at ${field.spacingInches}″ O.C.${field.needsReviewCount ? ` · ${field.needsReviewCount} require commercial/span review` : ' · bays validated and Takeoff optimized'}`;
    commit(next, 'Create joist field from structural host');
    return;
  }
  if (framingNodeGesture?.pointerId === event.pointerId) {
    const gesture = framingNodeGesture;
    const finalDocument = documentModel;
    framingNodeGesture = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') {
      message = 'Beam endpoint move canceled';
      persist();
      render();
    } else if (gesture.moved) {
      const beam = getBeams(finalDocument).find((entry) => entry.id === gesture.beamId);
      message = `Beam updated · ${formatFeetInches(beam.computed.lengthInches)} · Takeoff recalculated`;
      commit(finalDocument, 'Move Beam endpoint');
    } else {
      documentModel = finalDocument;
      render();
    }
    return;
  }
  if (catNoteDragStart?.pointerId === event.pointerId) {
    const gesture = catNoteDragStart;
    const finalDocument = documentModel;
    catNoteDragStart = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') { message = 'CAT Note move canceled'; persist(); render(); }
    else if (gesture.moved) { message = 'CAT Note label repositioned'; commit(finalDocument, 'Move CAT Note label'); }
    else { documentModel = finalDocument; persist(); render(); }
    return;
  }
  if (moveBoundaryGesture?.pointerId === event.pointerId) {
    const gesture = moveBoundaryGesture;
    const finalDocument = documentModel;
    moveBoundaryGesture = null;
    moveBoundaryMode = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') { message = 'Deck area move canceled'; persist(); render(); }
    else { message = 'Deck area and attached construction moved together'; commit(finalDocument, 'Move complete Deck Boundary assembly'); }
    return;
  }
  if (dimensionLeaderGesture?.pointerId === event.pointerId) {
    const gesture = dimensionLeaderGesture;
    const finalDocument = documentModel;
    dimensionLeaderGesture = null;
    dimensionLeaderMode = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') {
      message = 'Arrow reposition canceled';
      persist();
      render();
    } else {
      message = 'Dimension arrow repositioned · object relationship preserved';
      commit(finalDocument, 'Reposition dimension arrow');
    }
    return;
  }
  if (chamferGesture?.pointerId === event.pointerId) {
    const gesture = chamferGesture;
    const preview = chamferDraft;
    chamferGesture = null;
    chamferMode = null;
    chamferDraft = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel' || !preview) {
      message = event.type === 'pointercancel' ? 'Chamfer canceled' : 'Drag farther to create a chamfer';
      persist();
      render();
    } else {
      selected = { kind: 'edge', id: preview.chamferEdgeId };
      message = `45° chamfer created · ${formatInches(preview.setback)} setback`;
      commit(upsertObject(documentModel, markBoundaryEdited(preview.boundary)), 'Create 45-degree boundary chamfer');
    }
    return;
  }
  if (dimensionDragStart?.pointerId === event.pointerId) {
    const gesture = dimensionDragStart;
    const finalDocument = documentModel;
    dimensionDragStart = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel') {
      message = 'Dimension move canceled';
      persist();
      render();
    } else if (gesture.moved) {
      message = 'Dimension label repositioned';
      commit(finalDocument, 'Move dimension annotation');
    } else render();
    return;
  }
  if (railingGesture?.pointerId === event.pointerId) {
    const gesture = railingGesture;
    const draftRun = railingDraft;
    railingGesture = null;
    railingDraft = null;
    app.querySelector('.model-canvas')?.classList.remove('railing');
    if (event.type === 'pointercancel' || !draftRun?.geometry || draftRun.geometry.length < 12) {
      message = event.type === 'pointercancel' ? 'Railing placement canceled' : 'Drag at least 12 inches along the edge';
      render();
      return;
    }
    try {
      const railing = createRailingLine(draftRun.startAnchor, draftRun.endAnchor);
      let next = upsertObject(documentModel, railing);
      selected = { kind: 'railing', id: railing.id };
      mode = 'select';
      message = `${formatFeetInches(draftRun.geometry.length)} railing · ${draftRun.geometry.sectionCount} sections added`;
      commit(next, 'Add edge-hosted railing run');
    } catch (error) {
      message = error.message;
      render();
    }
    return;
  }
  if (stairSideGesture?.pointerId === event.pointerId) {
    const gesture = stairSideGesture;
    let finalDocument = documentModel;
    stairSideGesture = null;
    documentModel = gesture.document;
    if (event.type === 'pointercancel' || !gesture.moved) {
      message = event.type === 'pointercancel' ? 'Stair width edit canceled' : 'Stair side selected';
      persist();
      render();
    } else {
      const finalStair = finalDocument.objects.find((object) => object.type === 'stair' && object.id === gesture.stairId);
      const hostBoundary = finalStair ? finalDocument.objects.find((object) => object.type === 'deck-boundary' && object.id === finalStair.host.boundaryId) : null;
      const attachment = finalStair?.sideAttachments?.[gesture.side];
      const targetBoundary = attachment ? finalDocument.objects.find((object) => object.type === 'deck-boundary' && object.id === attachment.boundaryId) : null;
      if (finalStair && hostBoundary && targetBoundary) {
        const connected = materializeStairSideJunction(hostBoundary, targetBoundary, finalStair, gesture.side);
        finalDocument = upsertObject(upsertObject(finalDocument, markBoundaryEdited(connected.boundary)), connected.stair);
      }
      message = attachment ? 'Stair side connected · boundary split into selectable construction segments' : 'Stair width updated · parallel sides preserved';
      commit(finalDocument, 'Resize staircase from side');
    }
    return;
  }
  if (stairGesture?.pointerId === event.pointerId) {
    const gesture = stairGesture;
    const options = stairDraft;
    stairGesture = null;
    app.querySelector('.model-canvas')?.classList.remove('stairing');
    if (event.type === 'pointercancel' || !options?.totalRise || options.totalRun < 10) {
      stairDraft = null;
      message = event.type === 'pointercancel' ? 'Stair placement canceled' : 'Drag to at least 10 inches of total rise';
      render();
      return;
    }
    try {
      const hostBoundary = boundaryById(gesture.boundaryId ?? options.boundaryId) ?? boundary();
      const attached = attachStairToBoundary(hostBoundary, gesture.edgeId, { ...options, edgeId: gesture.edgeId });
      let next = upsertObject(documentModel, attached.stair);
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
  if (documentModel.objects.some((object) => object.type === 'stair' && Object.values(object.anchors ?? {}).includes(vertexId))) return true;
  if (documentModel.objects.some((object) => object.type === 'railing-run' && [object.anchors?.start?.vertexId, object.anchors?.end?.vertexId].includes(vertexId))) return true;
  if (documentModel.objects.some((object) => object.type === 'level-down' && object.vertices?.some((vertex) => vertex.anchor?.vertexId === vertexId))) return true;
  const current = boundary();
  const vertexIndex = current?.vertices.findIndex((vertex) => vertex.id === vertexId) ?? -1;
  if (vertexIndex < 0) return false;
  if (current.vertices[vertexIndex]?.junction) return true;
  const adjacentEdgeIds = new Set([current.edges[vertexIndex]?.id, current.edges[(vertexIndex - 1 + current.edges.length) % current.edges.length]?.id]);
  return documentModel.objects.some((object) => object.type === 'railing-run' && [object.host?.edgeId, object.anchors?.start?.edgeId, object.anchors?.end?.edgeId].some((edgeId) => adjacentEdgeIds.has(edgeId)));
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

function commitSelectedEdgeProperties(patch, label) {
  if (selected.kind === 'edge') {
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, patch)), label);
    return;
  }
  if (selected.kind === 'stair-edge') {
    const reference = findStairInterfaceByEdgeId(selected.id);
    if (reference) commit(upsertObject(documentModel, updateStairInterfaceEdgeProperties(reference.stair, patch)), label);
  }
}

function updateRailingHostAttachment(document, railing, attach) {
  const host = railing.host;
  if (!host) return document;
  if (host.edgeKind === 'stair-interface-edge') {
    const stair = document.objects.find((object) => object.type === 'stair' && object.id === host.ownerId);
    if (!stair) return document;
    const edge = getStairInterfaceEdge(stair);
    const currentIds = edge.properties.attachments.railingIds ?? [];
    const railingIds = attach ? [...new Set([...currentIds, railing.id])] : currentIds.filter((id) => id !== railing.id);
    return upsertObject(document, updateStairInterfaceEdgeProperties(stair, { attachments: { railingIds } }));
  }
  const current = document.objects.find((object) => object.type === 'deck-boundary' && object.id === host.boundaryId);
  const edge = current?.edges.find((entry) => entry.id === host.edgeId);
  if (!current || !edge) return document;
  const currentIds = normalizeBoundaryEdge(edge).properties.attachments.railingIds ?? [];
  const railingIds = attach ? [...new Set([...currentIds, railing.id])] : currentIds.filter((id) => id !== railing.id);
  return upsertObject(document, markBoundaryEdited(updateEdgeProperties(current, host.edgeId, { attachments: { railingIds } })));
}

function edgeHasRailingDependency(edgeId) {
  return documentModel.objects.some((object) => object.type === 'railing-run'
    && [object.host?.edgeId, object.anchors?.start?.edgeId, object.anchors?.end?.edgeId].includes(edgeId));
}

function removeSelectedRailing() {
  const railing = documentModel.objects.find((object) => object.type === 'railing-run' && object.id === selected.id);
  if (!railing) return;
  let next = updateRailingHostAttachment(documentModel, railing, false);
  next = { ...next, objects: next.objects.filter((object) => object.id !== railing.id) };
  selected = { kind: null, id: null };
  message = 'Railing run removed';
  commit(next, 'Remove railing run');
}

function selectedStairObject() {
  if (selected.kind === 'stair') return documentModel.objects.find((object) => object.type === 'stair' && object.id === selected.id) ?? null;
  if (selected.kind === 'dimension') return findStairByDimensionId(selected.id);
  if (selected.kind === 'stair-side') return findStairSide(selected.id)?.stair ?? null;
  return null;
}

function removeSelectedStair() {
  let stair = selectedStairObject();
  if (!stair) return;
  try {
    let next = documentModel;
    for (const side of ['start', 'end']) {
      const attachment = stair.sideAttachments?.[side];
      const target = attachment ? next.objects.find((object) => object.type === 'deck-boundary' && object.id === attachment.boundaryId) : null;
      if (!target || !attachment?.junction) continue;
      const disconnected = removeStairSideJunction(target, stair, side);
      stair = disconnected.stair;
      next = upsertObject(upsertObject(next, markBoundaryEdited(disconnected.boundary)), stair);
    }
    const host = next.objects.find((object) => object.type === 'deck-boundary' && object.id === stair.host.boundaryId);
    if (!host) { message = 'Stair host Deck Boundary was not found'; render(); return; }
    const restored = markBoundaryEdited(detachStairFromBoundary(host, stair));
    const interfaceId = getStairInterfaceEdge(stair).id;
    next = upsertObject(next, restored);
    next = {
      ...next,
      objects: next.objects.filter((object) => object.id !== stair.id && !(object.type === 'railing-run' && (object.host?.ownerId === stair.id || [object.host?.edgeId, object.anchors?.start?.edgeId, object.anchors?.end?.edgeId].includes(interfaceId)))),
    };
    selected = { kind: null, id: null };
    message = 'Stair removed · Deck Boundary restored';
    commit(next, 'Delete staircase');
  } catch (error) { message = error.message; render(); }
}

function adjustSelectedRailingPanels(delta) {
  const geometry = findResolvedRailingGeometry(selected.id) ?? findRailingGeometry(selected.id);
  if (!geometry) return;
  const nextCount = Math.max(geometry.minimumSectionCount, geometry.sectionCount + delta);
  if (nextCount === geometry.sectionCount) {
    message = 'This railing is already at the minimum safe panel count';
    render();
    return;
  }
  const updated = updateRailingSettings(geometry.railing, { sectionCountOverride: nextCount });
  message = `${nextCount} equal panels · ${nextCount + 1} positions on this run`;
  commit(upsertObject(documentModel, updated), delta > 0 ? 'Add railing panel' : 'Remove railing panel');
}

function toggleSelectedDimension() {
  const referenceId = selected.id;
  if (!referenceId) return;
  const visible = getDimensionLayer(documentModel).visible && isDimensionReferenceVisible(documentModel, referenceId);
  message = `Dimension ${visible ? 'removed' : 'added'}`;
  let next = setDimensionReferenceVisibility(documentModel, referenceId, !visible);
  if (!visible && !getDimensionLayer(next).visible) next = setDimensionLayerVisibility(next, true);
  if (selected.kind === 'dimension' && visible) selected = { kind: null, id: null };
  commit(next, visible ? 'Hide selected dimension' : 'Show selected dimension');
}

function breakSelectedEdge(segmentCount) {
  if (selected.kind !== 'edge' || edgeHasRailingDependency(selected.id) || isEdgeLocked(boundary(), selected.id)) return;
  const divided = markBoundaryEdited(splitEdgeIntoSegments(boundary(), selected.id, segmentCount));
  message = `Construction edge divided into ${segmentCount} equal segments`;
  commitBoundary(divided, `Divide construction edge into ${segmentCount} segments`);
}

function breakSelectedLevelDown(segmentCount) {
  if (selected.kind !== 'level-down') return;
  const reference = findLevelDownSegment(selected.id);
  if (!reference) return;
  const divided = splitLevelDownSegment(reference.levelDown, selected.id, segmentCount);
  message = `Level Down section divided into ${segmentCount} equal sections`;
  commit(upsertObject(documentModel, divided), `Divide Level Down section into ${segmentCount}`);
}

function resolveRailingSnap(raw) {
  const settings = getSnapSettings(documentModel);
  const tolerance = viewport.width / Math.max(app.querySelector('.model-canvas')?.clientWidth ?? 1000, 1) * 16;
  const targets = { vertices: [], edges: [] };
  boundaries().forEach((current) => {
    targets.vertices.push(...current.vertices.map((vertex) => ({ boundaryId: current.id, vertexId: vertex.id, point: { x: vertex.x, y: vertex.y } })));
    targets.edges.push(...current.edges.map((edge, index) => ({ boundaryId: current.id, edgeId: edge.id, edgeKind: 'boundary-edge', start: current.vertices[index], end: current.vertices[(index + 1) % current.vertices.length] })));
    documentModel.objects.filter((object) => object.type === 'stair' && object.host.boundaryId === current.id).forEach((stair) => {
      const edge = getStairInterfaceEdge(stair);
      const reference = resolveRailingHostByEdgeId(edge.id, 'stair-interface-edge');
      if (reference?.start && reference?.end) targets.edges.push({ boundaryId: current.id, edgeId: edge.id, edgeKind: 'stair-interface-edge', ownerId: stair.id, start: reference.start, end: reference.end, label: 'Stair interface snap' });
    });
  });
  return resolveRailingEndpointSnap(raw, targets, {
    tolerance,
    edges: settings.edges,
    grid: settings.grid,
    gridSpacing: gridSetting === 'auto' ? .5 : Number(gridSetting),
  });
}

function snapForPointer(raw, anchor, extraVertices = [], excludedIds = new Set(), pointerType = 'mouse') {
  const catSnapObjects = getCatConstructionLayer(documentModel).visible ? getCatSnapObjects(documentModel) : [];
  const framingSnapObjects = getFramingLayer(documentModel).visible
    ? [...getBeams(documentModel), ...getJoists(documentModel)].map((member) => ({
      id: member.id,
      vertices: [{ ...member.start, id: `${member.id}:start` }, { ...member.end, id: `${member.id}:end` }],
      edges: [{ id: member.id, startVertexId: `${member.id}:start`, endVertexId: `${member.id}:end` }],
    }))
    : [];
  const objects = [...boundaries(), ...catSnapObjects, ...framingSnapObjects];
  const settings = getSnapSettings(documentModel);
  const draftSnap = createBoundaryDraftSnapContext([...draft, ...extraVertices], anchor);
  const worldPerPixel = viewport.width / Math.max(app.querySelector('.model-canvas')?.clientWidth ?? 1000, 1);
  const isTouch = pointerType === 'touch';
  const tolerance = worldPerPixel * (isTouch ? 18 : 10);
  return resolveSnap(raw, {
    anchor,
    tolerance,
    inferenceTolerance: worldPerPixel * (isTouch ? 20 : 12),
    inferenceReleaseMultiplier: 1.45,
    maxInferenceReferenceDistance: Math.hypot(viewport.width, viewport.height) * .8,
    angleToleranceRadians: (isTouch ? 5 : 4) * Math.PI / 180,
    angleIncrementRadians: Math.PI / 8,
    grid: gridSetting === 'auto' ? .5 : Number(gridSetting),
    gridEnabled: settings.grid,
    edgesEnabled: settings.edges,
    nodeInference: settings.nodeInference,
    diagonalInference: settings.diagonalInference,
    anchorReferenceId: draftSnap.anchorReferenceId ?? anchor?.id ?? null,
    preferredReferenceId: snapState?.referenceId ?? null,
    targets: collectSnapTargets([...objects, draftSnap.object]).filter((target) => !excludedIds.has(target.referenceId)),
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
  const catPoints = [
    ...getCatLines(documentModel).flatMap((line) => line.vertices),
    ...getCatMeasurements(documentModel).flatMap((measurement) => [measurement.start, measurement.end]),
    ...getCatNotes(documentModel).flatMap((note) => [note.anchor, { x: note.anchor.x + note.labelOffset.x, y: note.anchor.y + note.labelOffset.y }]),
  ];
  const points = [...boundaries().flatMap((entry) => entry.vertices), ...catPoints, ...draft];
  const aspect = (svg?.clientWidth || 1000) / (svg?.clientHeight || 700);
  animateViewport(fitViewport(points, aspect));
  message = points.length ? 'Project fitted to workspace' : 'Workspace reset';
}

function canvasDoubleClick(svg, event) {
  const arcEdgeId = event.target.dataset.edgeId;
  if (arcEdgeId && getBoundaryArc(boundaryById(event.target.dataset.boundaryId), arcEdgeId)) {
    activateBoundary(event.target.dataset.boundaryId); selected = { kind: 'edge', id: arcEdgeId };
    handleAction('start-arch-line'); return;
  }
  const dimensionId = event.target.dataset.dimensionId;
  if (dimensionId) {
    event.preventDefault();
    editDimensionReference(dimensionId);
    return;
  }
  edgeDoubleClick(svg, event);
}

function editDimensionReference(referenceId) {
  const reference = resolveDimensionReference(referenceId);
  if (!reference) return;
  activateBoundary(reference.boundary?.id ?? boundaryForReference(referenceId)?.id);
  if (reference.kind === 'area') {
    selected = { kind: 'dimension', id: referenceId };
    message = 'Deck area selected · choose a construction action';
    render();
    return;
  }
  if (reference.kind === 'level-down-area') {
    selected = { kind: 'dimension', id: referenceId };
    message = 'Lowered area selected · edit its construction properties';
    render();
    return;
  }
  if (reference.kind === 'railing') {
    selected = { kind: 'railing', id: reference.railing.id };
    message = 'Railing measurement selected · drag a new run to change its extents';
    render();
    return;
  }
  if (reference.kind === 'stair') {
    selected = { kind: 'stair', id: reference.stair.id };
    message = 'Stair selected · edit rise, risers, treads, or width';
    render();
    return;
  }
  if (reference.kind === 'stair-interface') {
    selected = { kind: 'stair-edge', id: reference.edge.id };
    message = 'Edit the exact stair opening width';
    render();
    requestAnimationFrame(() => app.querySelector('#stair-interface-width')?.select());
    return;
  }
  if (reference.stair) {
    selected = { kind: 'stair', id: reference.stair.id };
    message = 'This dimension belongs to generated Stair geometry';
    render();
    return;
  }
  selected = { kind: 'edge', id: reference.edge.id };
  message = 'Edit the exact construction dimension';
  render();
  requestAnimationFrame(() => app.querySelector('#edge-length')?.select());
}

function edgeDoubleClick(svg, event) {
  if (mode !== 'select' || !event.target.dataset.edgeId) return;
  const current = boundary();
  const edgeId = event.target.dataset.edgeId;
  if (isEdgeLocked(current, edgeId)) { message = 'Unlock this construction edge before adding a node'; render(); return; }
  if (edgeHasRailingDependency(edgeId)) {
    message = 'Remove the hosted railing before splitting this construction edge';
    render();
    return;
  }
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
  selected = { kind: 'dimension', id: areaDimensionId(nextBoundary) };
  draft = [];
  pointerWorld = null;
  numericBuffer = '';
  mode = 'select';
  message = 'Deck boundary created';
  render();
}

function toggleSelectedEdgeOrientation(type) {
  if (selected.kind !== 'edge') return;
  const current = boundary();
  const active = getEdgeOrientationConstraint(current, selected.id);
  try {
    if (active?.type === type) {
      message = 'Angle constraint removed · edge is free';
      commitBoundary(markBoundaryEdited(clearEdgeOrientationConstraint(current, selected.id)), 'Remove edge orientation constraint');
      return;
    }
    const next = setEdgeOrientationConstraint(current, selected.id, type);
    const applied = getEdgeOrientationConstraint(next, selected.id);
    message = describeOrientationConstraint(applied);
    commitBoundary(markBoundaryEdited(next), type === 'fixed-angle' ? 'Lock edge angle' : `Constrain edge ${type}`);
  } catch (error) {
    message = error.message;
    render();
  }
}

function handleAction(action, source = null) {
  if (action === 'start-cat-arch-line' && selected.kind === 'cat') {
    const line = getCatLines(documentModel).find((entry) => entry.id === selected.id);
    if (!line) return;
    setMode('select'); catArchMode = { lineId: line.id }; message = 'CAT Arch line · click and drag the selected line; endpoints stay fixed'; render(); return;
  }
  if (action === 'straighten-cat-line' && selected.kind === 'cat') {
    const line = getCatLines(documentModel).find((entry) => entry.id === selected.id);
    if (!line) return;
    catArchMode = null; catArchGesture = null; catArchDraft = null; message = 'CAT Line straightened';
    commit(upsertObject(documentModel, setCatLineSagitta(line, 0)), 'Straighten CAT construction line'); return;
  }
  if (action === 'convert-cat-boundary' && ['cat-boundary', 'dimension'].includes(selected.kind)) {
    const region = selected.kind === 'dimension' ? resolveDimensionReference(selected.id)?.region : deriveCatBoundaries(documentModel).find((entry) => entry.id === selected.id);
    if (!region) { message = 'Closed CAT Boundary is no longer available'; render(); return; }
    try {
      const deck = convertCatBoundaryToDeckBoundary(region);
      const sourceIds = new Set(region.lineIds);
      let next = { ...documentModel, objects: documentModel.objects.filter((object) => !sourceIds.has(object.id)) };
      next = upsertObject(next, deck); activeBoundaryId = deck.id; selected = { kind: 'dimension', id: areaDimensionId(deck) };
      message = 'CAT Boundary converted to Deck Boundary · arcs preserved'; commit(next, 'Convert CAT Boundary to Deck Boundary');
    } catch (error) { message = error.message; render(); }
    return;
  }
  if (action === 'start-arch-line' && selected.kind === 'edge') {
    const reason = archLineBlockReason(documentModel, boundary(), selected.id);
    if (reason) { message = reason; render(); return; }
    const target = { boundaryId: boundary().id, edgeId: getBoundaryArc(boundary(), selected.id)?.id ?? selected.id };
    setMode('select'); archMode = target;
    message = 'Arch line · click and drag the selected edge; endpoints stay fixed'; render(); return;
  }
  if (action === 'straighten-arch-line' && selected.kind === 'edge') {
    const reason = archLineBlockReason(documentModel, boundary(), selected.id);
    if (reason) { message = reason; render(); return; }
    archMode = null; archDraft = null; archGesture = null;
    try { commitArchBoundary(straightenArchLine(boundary(), selected.id)); } catch (error) { message = error.message; render(); }
    return;
  }
  if (['clear-selection', 'undo', 'redo'].includes(action)) { archMode = null; archDraft = null; archGesture = null; catArchMode = null; catArchDraft = null; catArchGesture = null; }
  if (action.startsWith('framing-tool-')) {
    framingTool = action.slice('framing-tool-'.length);
    framingDraft = null;
    framingGesture = null;
    joistTargetBoundaryId = framingTool === 'joist' ? null : joistTargetBoundaryId;
    pointerWorld = null;
    message = framingTool === 'joist' ? 'Joist Field · select the Deck Boundary to fill' : framingTool === 'post' ? 'Post / Footing · tap beneath a Beam or Rim / Flush' : `Choose the first ${framingTool} endpoint`;
    render();
    return;
  }
  if (action.startsWith('framing-spacing-')) {
    framingSpacing = Number(action.slice('framing-spacing-'.length)) || DEFAULT_SPACING_INCHES;
    message = `Repeat spacing set to ${framingSpacing}″ on centre`;
    render();
    return;
  }
  if (action === 'framing-copies-less' || action === 'framing-copies-more') {
    framingCopies = Math.max(1, Math.min(MAX_COPIES, framingCopies + (action === 'framing-copies-more' ? 1 : -1)));
    render();
    return;
  }
  if (action === 'framing-array') {
    if (selected.kind !== 'framing') return;
    const host = boundary();
    const next = arrayObject(documentModel, selected.id, { spacingInches: framingSpacing, count: framingCopies, direction: 'perpendicular', clipPolygon: host?.vertices });
    const added = next.objects.length - documentModel.objects.length;
    if (!added) { message = 'No valid copies fit inside the active deck'; render(); return; }
    message = `${added} framing member${added === 1 ? '' : 's'} added at ${framingSpacing}″ O.C. inside the deck`;
    commit(next, `Repeat framing at ${framingSpacing}″ on centre`);
    return;
  }
  if (action === 'close-framing-tool') { framingDraft = null; framingGesture = null; pointerWorld = null; setMode('select'); return; }
  if (action === 'toggle-framing-visibility') {
    const visible = !getFramingLayer(documentModel).visible;
    message = `Framing layer ${visible ? 'shown' : 'hidden'}`;
    commit(setFramingLayerVisibility(documentModel, visible), 'Toggle Framing layer');
    return;
  }
  if (action === 'toggle-joists-visibility') {
    const visible = !getFramingLayer(documentModel).joistsVisible;
    message = `Joists layer ${visible ? 'shown' : 'hidden'}`;
    commit(setJoistLayerVisibility(documentModel, visible), 'Toggle Joists layer');
    return;
  }
  if ((action === 'move-joist-mesh' || action === 'add-single-joist') && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    const fieldId = joist?.layout?.fieldId;
    const boundaryId = joist?.layout?.boundaryId;
    if (!fieldId || !boundaryId || !boundaryById(boundaryId)) {
      message = 'This joist is not attached to an editable Joist Field';
      render();
      return;
    }
    if (action === 'move-joist-mesh') {
      const alreadyActive = joistMeshMoveMode?.fieldId === fieldId;
      joistMeshMoveMode = alreadyActive ? null : { fieldId, boundaryId };
      singleJoistMode = null;
      blockingAddMode = null;
      blockingMoveMode = null;
      message = alreadyActive ? 'Joist Field move canceled' : 'Move mesh active · drag any joist in this field';
    } else {
      const alreadyActive = singleJoistMode?.fieldId === fieldId;
      singleJoistMode = alreadyActive ? null : { fieldId, boundaryId };
      joistMeshMoveMode = null;
      blockingAddMode = null;
      blockingMoveMode = null;
      message = alreadyActive ? 'Single joist placement canceled' : 'Single joist active · click once anywhere inside this Deck Boundary';
    }
    render();
    return;
  }
  if ((action === 'add-blocking-row' || action === 'restore-blocking-rows') && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    const fieldId = joist?.layout?.fieldId;
    if (!fieldId) { message = 'This joist is not attached to an editable Joist Field'; render(); return; }
    if (action === 'restore-blocking-rows') {
      message = 'All automatic Joist Blocking rows restored · Takeoff recalculated';
      commit(restoreAutomaticBlockingRows(documentModel, fieldId), 'Restore automatic Joist Blocking');
      return;
    }
    const alreadyActive = blockingAddMode?.fieldId === fieldId;
    blockingAddMode = alreadyActive ? null : { fieldId };
    joistMeshMoveMode = null;
    singleJoistMode = null;
    blockingMoveMode = null;
    message = alreadyActive ? 'Blocking row placement canceled' : 'Blocking row active · click once across this Joist Field';
    render();
    return;
  }
  if (action === 'move-blocking-row' && selected.kind === 'blocking') {
    const row = deriveJoistBlockingRows(documentModel, { includeSuppressed: true }).find((entry) => entry.id === selected.id && !entry.automatic);
    if (!row) return;
    const alreadyActive = blockingMoveMode?.rowId === row.id;
    blockingMoveMode = alreadyActive ? null : { rowId: row.id };
    blockingAddMode = null;
    joistMeshMoveMode = null;
    singleJoistMode = null;
    message = alreadyActive ? 'Blocking row move canceled' : 'Move row active · drag the selected blocking row';
    render();
    return;
  }
  if (action === 'delete-blocking-row' && selected.kind === 'blocking') {
    const rowId = selected.id;
    selected = { kind: null, id: null };
    blockingMoveMode = null;
    message = 'Manual Joist Blocking row removed · Takeoff recalculated';
    commit(removeManualBlockingRow(documentModel, rowId), 'Delete manual Joist Blocking row');
    return;
  }
  if (action === 'apply-blocking-material' && selected.kind === 'blocking') {
    const row = deriveJoistBlockingRows(documentModel, { includeSuppressed: true }).find((entry) => entry.id === selected.id);
    if (!row) return;
    const value = app.querySelector('#blocking-material-size')?.value ?? 'match';
    const override = value === 'match' ? null : { size: value, material: row.blockingMaterial?.material };
    const next = setJoistBlockingMaterial(documentModel, row.fieldId, override);
    const resolved = deriveJoistBlockingRows(next, { includeSuppressed: true }).find((entry) => entry.fieldId === row.fieldId)?.blockingMaterial?.size;
    message = value === 'match' ? `Joist Blocking now matches the ${resolved ?? 'Joist Field'} array material` : `${value} assigned to all blocking in this Joist Field`;
    commit(next, 'Set Joist Blocking field material');
    return;
  }
  if ((action === 'suppress-blocking-row' || action === 'restore-selected-blocking') && selected.kind === 'blocking') {
    const suppress = action === 'suppress-blocking-row';
    message = suppress ? 'Automatic blocking row suppressed · excluded from Takeoff' : 'Automatic blocking row restored · Takeoff recalculated';
    commit(suppressAutomaticBlockingRow(documentModel, selected.id, suppress), suppress ? 'Suppress automatic Joist Blocking row' : 'Restore automatic Joist Blocking row');
    return;
  }
  if (action === 'toggle-ignore-joist-review' && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    if (!joist) return;
    const ignored = !joist.reviewIgnored;
    message = ignored ? 'Joist warning acknowledged · validation remains in project data' : 'Joist warning restored';
    commit(updateJoist(documentModel, joist.id, { reviewIgnored: ignored }), 'Acknowledge Joist warning');
    return;
  }
  if (action === 'apply-joist-standard' && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    const fieldId = joist?.layout?.fieldId;
    const fieldBoundary = boundaryById(joist?.layout?.boundaryId);
    if (!joist || !fieldId || !fieldBoundary) { message = 'This joist is not attached to an editable Joist Field'; render(); return; }
    const nominal = app.querySelector('#joist-nominal-size')?.value ?? '2x6';
    const speciesGroup = app.querySelector('#joist-species-group')?.value === 'redwood' ? 'redwood' : 'douglas-fir-larch';
    const size = `${nominal.replace('x', '×')} PT`;
    const result = updateJoistField(documentModel, fieldId, { boundary: fieldBoundary, supports: joistSupportsForBoundary(fieldBoundary), size, material: { ...joist.material, speciesGroup, grade: 'No. 2', treatment: 'PT' } });
    if (!result.changed) { message = result.reason; render(); return; }
    selected = { kind: 'framing', id: result.joists.find((entry) => entry.id === joist.id)?.id ?? result.joists[0]?.id };
    message = `${size} applied to ${result.joists.length} joists · Rim / Flush, Blocking, Ledger, span, and Takeoff synchronized`;
    commit(result.document, 'Set entire Joist Field material and validate span');
    return;
  }
  if (action === 'set-joist-field-spacing' && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    const fieldId = joist?.layout?.fieldId;
    const fieldBoundary = boundaryById(joist?.layout?.boundaryId);
    const requested = source?.dataset.spacing === 'custom' ? Number(app.querySelector('#joist-field-custom-spacing')?.value) : Number(source?.dataset.spacing);
    if (!joist || !fieldId || !fieldBoundary) { message = 'This joist is not attached to an editable Joist Field'; render(); return; }
    if (!Number.isFinite(requested) || requested < 1 || requested > 48) { message = 'Enter a custom spacing from 1″ to 48″ on centre'; render(); return; }
    const result = updateJoistField(documentModel, fieldId, { boundary: fieldBoundary, supports: joistSupportsForBoundary(fieldBoundary), spacingInches: requested });
    if (!result.changed) { message = result.reason; render(); return; }
    selected = { kind: 'framing', id: result.joists.find((entry) => entry.id === joist.id)?.id ?? result.joists[0]?.id };
    message = `Joist Field regenerated at ${requested}″ O.C. · ${result.joists.length} members · Blocking and Takeoff recalculated`;
    commit(result.document, 'Change entire Joist Field spacing');
    return;
  }
  if (action === 'apply-framing-size' && selected.kind === 'framing') {
    const object = documentModel.objects.find((entry) => entry.id === selected.id);
    if (!object) return;
    message = 'Framing size label updated';
    const size = String(app.querySelector('#framing-size')?.value ?? '').trim();
    commit(object.type === 'joist' ? updateJoist(documentModel, object.id, { size }) : upsertObject(documentModel, { ...object, size }), 'Set framing size');
    return;
  }
  if (action === 'apply-beam-material' && selected.kind === 'framing') {
    const object = getBeams(documentModel).find((entry) => entry.id === selected.id);
    if (!object) return;
    const presetId = app.querySelector('#beam-size-preset')?.value ?? '4x6';
    const preset = BEAM_SIZE_PRESETS.find((entry) => entry.id === presetId);
    const customLabel = String(app.querySelector('#beam-custom-size')?.value ?? '').trim();
    if (!preset && !customLabel) { message = 'Enter a custom Beam size before applying'; render(); return; }
    const material = preset
      ? { preset: preset.id, widthInches: preset.widthInches, depthInches: preset.depthInches, treatment: 'PT' }
      : { preset: 'custom', treatment: 'PT', customLabel };
    const updated = updateBeam(documentModel, object.id, { material });
    const updatedBeam = getBeams(updated).find((entry) => entry.id === object.id);
    const geometry = deriveBeamGeometry(updatedBeam, getFramingLayer(updated).settings, deriveBeamLoad(updated, updatedBeam));
    message = `${beamMaterialLabel(material)} assigned · ${geometry?.postCount ?? 0} supports · Takeoff recalculated`;
    commit(updated, 'Set Beam material');
    return;
  }
  if (action === 'set-framing-system' && selected.kind === 'framing') {
    const object = documentModel.objects.find((entry) => entry.id === selected.id && entry.type === 'beam');
    if (!object) return;
    const system = source?.dataset.system === 'flush' ? 'flush' : 'bottom';
    message = system === 'flush' ? 'Flush beam · joists hang from its face' : 'Bottom beam · joists bear on top';
    commit(upsertObject(documentModel, { ...object, settings: { ...object.settings, framingSystem: system } }), 'Set beam framing system');
    return;
  }
  if (action === 'apply-beam-posts' && selected.kind === 'framing') {
    const object = documentModel.objects.find((entry) => entry.id === selected.id && entry.type === 'beam');
    const wanted = Math.floor(Number(app.querySelector('#beam-post-count')?.value));
    const minimum = object ? deriveBeamGeometry(object, getFramingLayer(documentModel).settings, deriveBeamLoad(documentModel, object))?.minimumPostCount : null;
    if (!object || !Number.isFinite(wanted) || wanted < minimum) { message = `This beam requires at least ${minimum ?? 2} posts`; render(); return; }
    message = `Beam now derives ${wanted} posts and footings`;
    commit(upsertObject(documentModel, { ...object, settings: { ...object.settings, postCountOverride: wanted } }), 'Set beam post count');
    return;
  }
  if (action === 'delete-framing' && selected.kind === 'framing') {
    const target = documentModel.objects.find((object) => object.id === selected.id);
    if (!target) return;
    joistMeshMoveMode = null;
    joistMeshMoveGesture = null;
    singleJoistMode = null;
    selected = { kind: null, id: null };
    message = 'Framing object removed';
    commit({ ...documentModel, objects: documentModel.objects.filter((object) => object.id !== target.id) }, 'Delete framing object');
    return;
  }
  if (action === 'delete-joist-field' && selected.kind === 'framing') {
    const joist = getJoists(documentModel).find((entry) => entry.id === selected.id);
    const fieldId = joist?.layout?.fieldId;
    if (!fieldId) { message = 'This joist is not attached to a Joist Field'; render(); return; }
    const count = getJoists(documentModel).filter((entry) => entry.layout?.fieldId === fieldId).length;
    joistMeshMoveMode = null;
    joistMeshMoveGesture = null;
    singleJoistMode = null;
    blockingAddMode = null;
    blockingMoveMode = null;
    selected = { kind: null, id: null };
    message = `Entire Joist Field removed · ${count} joists and field Blocking cleared · Undo available`;
    commit(removeJoistField(documentModel, fieldId), 'Delete entire Joist Field');
    return;
  }
  if (action === 'toggle-project-menu') { projectMenuOpen = !projectMenuOpen; exportMenuOpen = false; pendingProjectDeleteId = null; render(); return; }
  if (action === 'close-project-menu') { projectMenuOpen = false; pendingProjectDeleteId = null; render(); return; }
  if (action === 'toggle-export-menu') { exportMenuOpen = !exportMenuOpen; projectMenuOpen = false; pendingProjectDeleteId = null; render(); return; }
  if (action === 'open-takeoff') { takeoffOpen = true; exportMenuOpen = false; projectMenuOpen = false; takeoffAddCategory = null; message = 'Editable project takeoff generated'; render(); return; }
  if (action === 'close-takeoff') { takeoffOpen = false; takeoffAddCategory = null; message = 'Takeoff saved with this project'; render(); return; }
  if (action === 'toggle-takeoff-category') {
    const category = source?.dataset.category;
    if (!category) return;
    if (takeoffExpanded.has(category)) takeoffExpanded.delete(category); else takeoffExpanded.add(category);
    render(); return;
  }
  if (action === 'set-takeoff-view') {
    takeoffViewMode = source?.dataset.view === 'consolidated' ? 'consolidated' : 'detailed';
    takeoffAddCategory = null;
    takeoffExpanded = new Set(TAKEOFF_CATEGORIES.map((category) => category.id));
    message = takeoffViewMode === 'consolidated' ? 'Purchase list consolidated by material and stock size' : 'Detailed construction Takeoff restored';
    render();
    return;
  }
  if (action === 'add-takeoff-line') { takeoffAddCategory = source?.dataset.category ?? 'custom'; takeoffExpanded.add(takeoffAddCategory); render(); requestAnimationFrame(() => app.querySelector('#takeoff-new-description')?.focus()); return; }
  if (action === 'cancel-takeoff-line') { takeoffAddCategory = null; render(); return; }
  if (action === 'save-takeoff-line') {
    try {
      const next = addManualTakeoffLine(documentModel, {
        category: source?.dataset.category,
        description: app.querySelector('#takeoff-new-description')?.value,
        specification: app.querySelector('#takeoff-new-specification')?.value,
        quantity: app.querySelector('#takeoff-new-quantity')?.value,
        unit: app.querySelector('#takeoff-new-unit')?.value,
        unitPrice: app.querySelector('#takeoff-new-price')?.value,
      });
      takeoffAddCategory = null;
      message = 'Manual material added to Takeoff';
      commit(next, 'Add manual takeoff material');
    } catch (error) { message = error.message; render(); }
    return;
  }
  if (action === 'delete-takeoff-line') { message = 'Manual material removed'; commit(removeManualTakeoffLine(documentModel, source?.dataset.lineId), 'Remove manual takeoff material'); return; }
  if (action === 'reset-takeoff-line') { message = 'Calculated material quantity restored'; commit(resetTakeoffLine(documentModel, source?.dataset.lineId), 'Reset takeoff material calculation'); return; }
  if (action === 'download-takeoff-json') { downloadJson(createTakeoffExport(documentModel, { ...takeoffContext(), includePrices: true, mode: takeoffViewMode }), `takeoff-${takeoffViewMode}`); message = `${takeoffViewMode === 'consolidated' ? 'Consolidated purchase' : 'Detailed Takeoff'} JSON downloaded`; render(); return; }
  if (action === 'print-takeoff-quote') { printTakeoff(false); return; }
  if (action === 'print-takeoff-priced') { printTakeoff(true); return; }
  if (action === 'rename-project') {
    const name = app.querySelector('#project-name-input')?.value.trim();
    if (!name) { message = 'Enter a project name'; render(); return; }
    documentModel = { ...documentModel, name, updatedAt: new Date().toISOString() };
    persist();
    projectMenuOpen = true;
    message = 'Project name updated';
    render();
    return;
  }
  if (action === 'new-project') {
    persist();
    const next = createProjectDocument({ name: `Deck project ${projectLibrary.projects.length + 1}` });
    projectLibrary = upsertLibraryProject(projectLibrary, next);
    documentModel = next;
    history = new CommandStack();
    resetProjectWorkspaceState();
    projectMenuOpen = true;
    persist();
    message = 'New independent project created';
    render();
    return;
  }
  if (action === 'open-project') {
    const projectId = source?.dataset.projectId;
    if (!projectId || projectId === documentModel.id) return;
    persist();
    projectLibrary = activateLibraryProject(projectLibrary, projectId);
    documentModel = getActiveProject(projectLibrary);
    history = new CommandStack();
    resetProjectWorkspaceState();
    projectMenuOpen = false;
    persist();
    message = `${documentModel.name} opened`;
    render();
    return;
  }
  if (action === 'request-delete-project') { pendingProjectDeleteId = source?.dataset.projectId ?? null; projectMenuOpen = true; render(); return; }
  if (action === 'cancel-delete-project') { pendingProjectDeleteId = null; projectMenuOpen = true; render(); return; }
  if (action === 'confirm-delete-project') {
    const projectId = source?.dataset.projectId;
    if (!projectId) return;
    projectLibrary = removeLibraryProject(projectLibrary, projectId);
    if (!projectLibrary.projects.length) projectLibrary = createProjectLibrary(createProjectDocument({ name: 'New deck project' }));
    documentModel = getActiveProject(projectLibrary);
    history = new CommandStack();
    resetProjectWorkspaceState();
    projectMenuOpen = true;
    pendingProjectDeleteId = null;
    persist();
    message = 'Local project deleted';
    render();
    return;
  }
  if (action === 'save-step-one') { saveToStepOne(); return; }
  if (action === 'download-step-one-json') { downloadStepOneJson(); return; }
  if (action === 'export-pdf') { exportProjectPdf(); return; }
  if (action === 'clear-selection') { selected = { kind: null, id: null }; dimensionLeaderMode = null; dimensionLeaderGesture = null; chamferMode = null; chamferGesture = null; chamferDraft = null; moveBoundaryMode = null; moveBoundaryGesture = null; joistMeshMoveMode = null; joistMeshMoveGesture = null; singleJoistMode = null; blockingAddMode = null; blockingMoveMode = null; blockingMoveGesture = null; boardingDirectionMode = null; pendingDeckDeleteId = null; message = 'Ready'; render(); }
  if (action === 'add-deck-boundary') {
    mode = 'draw'; draft = []; pointerWorld = null; selected = { kind: null, id: null };
    message = 'Draw the first corner of the new Deck Boundary';
    render();
  }
  if (action === 'apply-boundary-level' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    const level = parseConstructionLength(app.querySelector('#boundary-level-down')?.value);
    if (reference?.kind !== 'area' || level === null) { message = 'Enter a valid down level such as 18 in'; render(); }
    else {
      message = `Local deck set ${formatInches(level)} below the project datum`;
      const leveled = markBoundaryEdited(setBoundaryLevelDown(reference.boundary, level));
      commit(synchronizeConnectedStairLevels(upsertObject(documentModel, leveled)), 'Set Deck Boundary down level');
    }
  }
  if (action === 'move-deck-area' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind !== 'area') return;
    moveBoundaryMode = { boundaryId: reference.boundary.id };
    message = 'Move Deck Area active · drag anywhere to reposition the complete assembly';
    render();
  }
  if (action === 'set-board-direction' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind !== 'area') return;
    boardingDirectionMode = { boundaryId: reference.boundary.id };
    moveBoundaryMode = null;
    pendingDeckDeleteId = null;
    message = 'Board direction active · select a straight reference or a curved Deck Boundary edge';
    render();
  }
  if (action === 'rotate-board-direction' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind !== 'area' || !getDeckBoarding(reference.boundary)) return;
    message = 'Deck board direction rotated 90 degrees';
    commit(upsertObject(documentModel, markBoundaryEdited(rotateDeckBoardingDirection(reference.boundary))), 'Rotate deck board direction');
  }
  if (action === 'clear-board-direction' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind !== 'area') return;
    boardingDirectionMode = null;
    message = 'Deck board pattern removed';
    commit(upsertObject(documentModel, markBoundaryEdited(clearDeckBoardingDirection(reference.boundary))), 'Clear deck board direction');
  }
  if (action === 'request-delete-deck' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind !== 'area') return;
    pendingDeckDeleteId = reference.boundary.id;
    boardingDirectionMode = null;
    message = 'Review the complete deck deletion before confirming';
    render();
  }
  if (action === 'cancel-delete-deck') {
    pendingDeckDeleteId = null;
    message = 'Deck area kept';
    render();
  }
  if (action === 'confirm-delete-deck' && pendingDeckDeleteId) {
    try {
      const deletedBoundaryId = pendingDeckDeleteId;
      const result = deleteDeckAssembly(documentModel, deletedBoundaryId);
      const remaining = result.document.objects.filter((object) => object.type === 'deck-boundary');
      pendingDeckDeleteId = null;
      boardingDirectionMode = null;
      activeBoundaryId = remaining[0]?.id ?? null;
      selected = { kind: null, id: null };
      mode = remaining.length ? 'select' : 'draw';
      const removedObjects = result.removed.stairCount + result.removed.railingCount + result.removed.levelDownCount;
      message = remaining.length ? `Deck area deleted${removedObjects ? ` with ${removedObjects} attached object${removedObjects === 1 ? '' : 's'}` : ''}` : 'Deck area deleted · draw a new boundary when ready';
      commit(result.document, 'Delete complete Deck Boundary assembly');
    } catch (error) {
      pendingDeckDeleteId = null;
      message = error.message;
      render();
    }
  }
  if (action === 'lock-edge' && selected.kind === 'edge') {
    message = 'Construction edge locked · position and length protected';
    commitBoundary(markBoundaryEdited(setEdgeLocked(boundary(), selected.id, true)), 'Lock construction edge');
  }
  if (action === 'unlock-edge' && selected.kind === 'edge') {
    message = 'Construction edge unlocked';
    commitBoundary(markBoundaryEdited(setEdgeLocked(boundary(), selected.id, false)), 'Unlock construction edge');
  }
  if (action === 'lock-vertex' && selected.kind === 'vertex') {
    message = 'Boundary node locked in place';
    commitBoundary(markBoundaryEdited(setVertexLocked(boundary(), selected.id, true)), 'Lock boundary node');
  }
  if (action === 'unlock-vertex' && selected.kind === 'vertex') {
    message = 'Boundary node unlocked';
    commitBoundary(markBoundaryEdited(setVertexLocked(boundary(), selected.id, false)), 'Unlock boundary node');
  }
  if (action === 'start-45-chamfer' && selected.kind === 'vertex') {
    if (isVertexReferencedByAttachment(selected.id)) { message = 'This node anchors another construction object and cannot be chamfered'; render(); return; }
    chamferMode = { vertexId: selected.id };
    chamferGesture = null;
    chamferDraft = null;
    message = '45° Chamfer active · drag anywhere to set the setback';
    render();
  }
  if (action === 'add-railing-panel' && selected.kind === 'railing') adjustSelectedRailingPanels(1);
  if (action === 'remove-railing-panel' && selected.kind === 'railing') adjustSelectedRailingPanels(-1);
  if (action === 'toggle-double-railing-corner' && selected.kind === 'railing-post') {
    const post = findRailingPost(selected.id);
    if (!post?.cornerId) { message = 'Double post is available only at a shared corner between two different railing directions'; render(); return; }
    const doubled = !post.doubled;
    const nextDocument = setRailingCornerDouble(documentModel, post.cornerId, doubled);
    const nextLayout = deriveRailingPostLayout(getAllRailingGeometries(), nextDocument.railingCornerSettings);
    const nextPost = nextLayout.posts.find((entry) => entry.cornerId === post.cornerId);
    if (nextPost) selected = { kind: 'railing-post', id: nextPost.id };
    message = `${doubled ? 'Double' : 'Single'} corner post · equal spacing regenerated · ${nextLayout.physicalPostCount} visible posts in Takeoff`;
    commit(nextDocument, doubled ? 'Enable double railing corner post' : 'Disable double railing corner post');
    return;
  }
  if (action === 'toggle-decking') {
    const visible = !getDeckingLayer(documentModel).visible;
    message = `Decking layer ${visible ? 'shown' : 'hidden'}`;
    commit(setDeckingLayerVisibility(documentModel, visible), 'Toggle Decking layer');
  }
  if (action === 'toggle-selected-dimension' && ['edge', 'stair-edge', 'dimension'].includes(selected.kind)) toggleSelectedDimension();
  if (action === 'hide-selected-boundary' && selected.kind === 'dimension') {
    const reference = resolveDimensionReference(selected.id);
    if (reference?.kind === 'area') {
      message = 'Deck Boundary hidden · its area annotation remains available';
      commit(setDeckBoundaryVisibility(documentModel, reference.boundary.id, false), 'Hide selected Deck Boundary');
    } else if (reference?.kind === 'cat-area') {
      message = 'CAT Boundary hidden · its area annotation remains available';
      commit(setCatBoundaryVisibility(documentModel, reference.region, false), 'Hide selected CAT Boundary');
    }
    return;
  }
  if (action === 'show-all-boundaries') {
    message = 'All Deck and CAT Boundaries shown';
    commit(showAllBoundaries(documentModel), 'Show all boundaries');
    return;
  }
  if (action === 'reposition-dimension-arrow' && ['edge', 'stair-edge', 'dimension'].includes(selected.kind)) {
    const referenceId = selected.id;
    let next = setDimensionReferenceVisibility(documentModel, referenceId, true);
    if (!getDimensionLayer(next).visible) next = setDimensionLayerVisibility(next, true);
    documentModel = next;
    persist();
    dimensionLeaderMode = { referenceId };
    message = 'Arrow tip is active · touch or drag anywhere to reposition it';
    render();
  }
  if (action === 'reset-dimension-arrow' && selected.kind === 'dimension') {
    dimensionLeaderMode = null;
    message = 'Dimension arrow returned to its object';
    commit(setDimensionLeaderOffset(documentModel, selected.id, { x: 0, y: 0 }), 'Reset dimension arrow');
  }
  if (action === 'break-edge-2') breakSelectedEdge(2);
  if (action === 'break-edge-3') breakSelectedEdge(3);
  if (action === 'quick-house-attachment' && selected.kind === 'edge') {
    const edge = boundary().edges.find((entry) => entry.id === selected.id);
    if (edge) {
      const role = edge.role === 'house' ? 'open' : 'house';
      let next = setEdgeRole(boundary(), selected.id, role);
      next = updateEdgeProperties(next, selected.id, { attachments: { ledger: role === 'house' } });
      message = role === 'house' ? 'House attachment assigned · Ledger enabled by default' : 'House attachment and Ledger removed';
      commitBoundary(markBoundaryEdited(next), 'Toggle House Attachment relationship');
    }
  }
  if (action === 'quick-ledger' && selected.kind === 'edge') {
    const edge = boundary().edges.find((entry) => entry.id === selected.id);
    if (!edge || edge.role !== 'house') return;
    const active = normalizeBoundaryEdge(edge).properties.attachments.ledger !== false;
    message = active ? 'Ledger removed · House Attachment preserved' : 'Ledger enabled · joist-bearing connection';
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { attachments: { ledger: !active } })), 'Toggle structural Ledger');
  }
  if (action === 'quick-rim-joist' && selected.kind === 'edge') {
    const edge = boundary().edges.find((entry) => entry.id === selected.id);
    if (!edge) return;
    const active = normalizeRimJoist(normalizeBoundaryEdge(edge).properties.attachments.rimJoist).enabled;
    const arc = getBoundaryArc(boundary(), selected.id);
    const rimJoist = active ? null : createRimJoistProperty(arc ? { inheritedFromJoistField: true } : {});
    message = active ? 'Rim joist / flush beam removed from edge' : arc ? 'Arc converted to curved rim joist · profile follows Joist Field' : 'Boundary edge converted to 2×6 PT rim joist / flush beam';
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { attachments: { rimJoist } })), 'Toggle Boundary Rim Joist');
  }
  if (action === 'apply-rim-joist-material' && selected.kind === 'edge') {
    const edge = boundary().edges.find((entry) => entry.id === selected.id);
    if (!edge) return;
    const currentRim = normalizeRimJoist(normalizeBoundaryEdge(edge).properties.attachments.rimJoist);
    if (!currentRim.enabled) return;
    const presetId = app.querySelector('#rim-joist-size-preset')?.value ?? '2x6';
    const preset = RIM_JOIST_SIZE_PRESETS.find((entry) => entry.id === presetId);
    const customLabel = String(app.querySelector('#rim-joist-custom-size')?.value ?? '').trim();
    if (!preset && !customLabel) { message = 'Enter a custom rim joist size before applying'; render(); return; }
    const rimJoist = createRimJoistProperty(preset
      ? { preset: preset.id, widthInches: preset.widthInches, depthInches: preset.depthInches, treatment: 'PT', plyCount: currentRim.plyCount }
      : { preset: 'custom', customLabel, treatment: 'PT', plyCount: currentRim.plyCount });
    message = `${rimJoistLabel(rimJoist)} rim joist assigned · Takeoff recalculated`;
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { attachments: { rimJoist } })), 'Set Rim Joist material');
  }
  if (action === 'toggle-double-rim-joist' && selected.kind === 'edge') {
    const edge = boundary().edges.find((entry) => entry.id === selected.id);
    if (!edge) return;
    const currentRim = normalizeRimJoist(normalizeBoundaryEdge(edge).properties.attachments.rimJoist);
    if (!currentRim.enabled) return;
    const rimJoist = { ...currentRim, plyCount: currentRim.plyCount === 2 ? 1 : 2 };
    message = rimJoist.plyCount === 2 ? 'Double rim joist enabled · material quantity doubled' : 'Single rim joist enabled';
    commitBoundary(markBoundaryEdited(updateEdgeProperties(boundary(), selected.id, { attachments: { rimJoist } })), 'Toggle double Rim Joist');
  }
  if (action === 'quick-fascia' && ['edge', 'stair-edge'].includes(selected.kind)) {
    const edge = selected.kind === 'edge' ? boundary().edges.find((entry) => entry.id === selected.id) : findStairInterfaceByEdgeId(selected.id)?.edge;
    if (edge) { message = 'Fascia property updated'; commitSelectedEdgeProperties({ finishes: { fascia: !normalizeBoundaryEdge(edge).properties.finishes.fascia } }, 'Toggle edge fascia'); }
  }
  if (action === 'quick-picture-frame' && ['edge', 'stair-edge'].includes(selected.kind)) {
    const edge = selected.kind === 'edge' ? boundary().edges.find((entry) => entry.id === selected.id) : findStairInterfaceByEdgeId(selected.id)?.edge;
    if (edge) { message = 'Picture frame property updated'; commitSelectedEdgeProperties({ finishes: { pictureFrame: !normalizeBoundaryEdge(edge).properties.finishes.pictureFrame } }, 'Toggle edge picture frame'); }
  }
  if (action === 'select-stair-interface' && selectedStairObject()) {
    const stair = selectedStairObject();
    if (stair) { selected = { kind: 'stair-edge', id: getStairInterfaceEdge(stair).id }; message = 'Deck–Stair interface selected'; render(); }
  }
  if (action === 'select-stair-object' && selected.kind === 'stair-side') {
    const stair = findStairSide(selected.id)?.stair;
    if (stair) { selected = { kind: 'stair', id: stair.id }; message = 'Stair selected'; render(); }
  }
  if (action === 'apply-stair-dimensions' && selectedStairObject()) {
    const stair = selectedStairObject();
    const host = boundaryById(stair.host.boundaryId);
    const totalRise = stair.destination ? stair.dimensions.totalRise : parseConstructionLength(app.querySelector('#stair-total-rise')?.value);
    const riserHeight = parseConstructionLength(app.querySelector('#stair-riser-height')?.value);
    const treadDepth = parseConstructionLength(app.querySelector('#stair-tread-depth')?.value);
    if (!host || totalRise === null || riserHeight === null || treadDepth === null) { message = 'Enter valid Stair dimensions'; render(); }
    else {
      try {
        const regenerated = updateStairDimensions(host, stair, { totalRise, riserHeight, treadDepth });
        let next = upsertObject(documentModel, markBoundaryEdited(regenerated.boundary));
        next = upsertObject(next, regenerated.stair);
        selected = { kind: 'stair', id: stair.id };
        message = `${regenerated.stair.dimensions.riserCount} equal risers · ${regenerated.stair.dimensions.treadCount} equal treads`;
        commit(next, 'Edit staircase dimensions');
      } catch (error) { message = error.message; render(); }
    }
  }
  if (action === 'delete-stair' && selectedStairObject()) removeSelectedStair();
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
    else { try { message = 'Edge length updated precisely'; commitBoundary(markBoundaryEdited(setEdgeLength(boundary(), selected.id, length)), 'Set boundary edge length'); } catch (error) { message = error.message; render(); } }
  }
  if (action === 'apply-edge-offset' && selected.kind === 'edge') {
    const offset = parseConstructionLength(app.querySelector('#edge-offset')?.value);
    if (offset === null) { message = 'Enter an offset such as 6 in or -1 ft'; render(); }
    else { try { message = 'Construction edge moved'; commitBoundary(markBoundaryEdited(offsetEdge(boundary(), selected.id, offset)), 'Offset boundary edge'); } catch (error) { message = error.message; render(); } }
  }
  if (action === 'apply-stair-width' && selected.kind === 'stair-edge') {
    const width = parseConstructionLength(app.querySelector('#stair-interface-width')?.value);
    const reference = findStairInterfaceByEdgeId(selected.id);
    if (!width || !reference) { message = 'Enter a valid stair opening width'; render(); }
    else {
      try {
        const resized = setStairWidth(boundary(), reference.stair, width);
        let next = upsertObject(documentModel, markBoundaryEdited(resized.boundary));
        next = upsertObject(next, resized.stair);
        message = 'Deck–Stair interface width updated';
        commit(next, 'Set stair opening width');
      } catch (error) { message = error.message; render(); }
    }
  }
  if (action === 'constraint-horizontal') toggleSelectedEdgeOrientation('horizontal');
  if (action === 'constraint-vertical') toggleSelectedEdgeOrientation('vertical');
  if (action === 'constraint-lock-angle') toggleSelectedEdgeOrientation('fixed-angle');
  if (action === 'insert-midpoint' && selected.kind === 'edge') {
    const current = boundary();
    const edgeIndex = current.edges.findIndex((edge) => edge.id === selected.id);
    if (edgeHasRailingDependency(selected.id)) {
      message = 'Remove the hosted railing before splitting this construction edge';
      render();
      return;
    }
    if (isEdgeLocked(current, selected.id)) { message = 'Unlock this construction edge before inserting a node'; render(); return; }
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
    if (isEdgeLocked(boundary(), selected.id)) { message = 'Unlock this construction edge before attaching a staircase'; render(); return; }
    mode = 'stair';
    stairDraft = { edgeId: selected.id, width: 36, totalRise: 0, totalRun: 0, treadDepth: 0, riserCount: 0, treadCount: 0 };
    message = 'Press this edge and drag outward · release at the required total rise';
    render();
  }
  if (action === 'cancel-stair') { stairGesture = null; stairDraft = null; mode = 'select'; message = 'Stair placement canceled'; render(); }
  if (action === 'make-boundary-90') {
    try {
      message = 'Boundary aligned to horizontal and vertical construction planes';
      commitBoundary(markBoundaryEdited(orthogonalizeBoundary(boundary())), 'Make Deck Boundary corners 90 degrees');
    } catch (error) { message = error.message; render(); }
  }
  if (action === 'start-level-down') {
    mode = 'level-down'; levelDownDraft = []; levelDownPointer = null;
    message = 'Click a boundary edge or corner to start Level Down';
    render();
  }
  if (action === 'cancel-level-down') {
    mode = 'select'; levelDownDraft = []; levelDownPointer = null;
    message = 'Level Down canceled';
    render();
  }
  if (action === 'apply-level-down-riser' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    const height = parseConstructionLength(app.querySelector('#quick-level-down-riser')?.value);
    if (!levelDown || height === null) { message = 'Enter a valid drop height'; render(); }
    else {
      try {
        message = `${formatInches(height)} drop applied to the entire lowered area`;
        commit(upsertObject(documentModel, setLevelDownRiserHeight(levelDown, height)), 'Set lowered-area drop height');
      } catch (error) { message = error.message; render(); }
    }
  }
  if (action === 'make-level-down-90' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    message = 'Lowered-area line converted to 90° construction segments';
    commit(upsertObject(documentModel, orthogonalizeLevelDown(levelDown)), 'Make lowered-area line 90 degrees');
  }
  if (action === 'quick-level-picture-frame' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    const active = levelDown.properties?.finishes?.pictureFrame ?? false;
    message = `Lowered-area picture frame ${active ? 'removed' : 'assigned'}`;
    commit(upsertObject(documentModel, updateLevelDownProperties(levelDown, { finishes: { pictureFrame: !active } })), 'Toggle lowered-area picture frame');
  }
  if (action === 'quick-level-fascia' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    const active = levelDown.properties?.finishes?.fascia ?? false;
    message = `Lowered-area fascia ${active ? 'removed' : 'assigned'}`;
    commit(upsertObject(documentModel, updateLevelDownProperties(levelDown, { finishes: { fascia: !active } })), 'Toggle lowered-area fascia');
  }
  if (action === 'flip-level-down-side' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    const side = levelDown.properties?.regionSide === 'larger' ? 'smaller' : 'larger';
    message = 'Lowered side flipped';
    commit(upsertObject(documentModel, updateLevelDownProperties(levelDown, { regionSide: side })), 'Flip lowered-area side');
  }
  if (action === 'break-level-down-2') breakSelectedLevelDown(2);
  if (action === 'break-level-down-3') breakSelectedLevelDown(3);
  if (action === 'delete-level-down' && selectedLevelDown()) {
    const levelDown = selectedLevelDown();
    if (levelDown) {
      const next = { ...documentModel, objects: documentModel.objects.filter((object) => object.id !== levelDown.id) };
      selected = { kind: null, id: null };
      message = 'Level Down removed · Railing remains unchanged';
      commit(next, 'Remove Level Down construction polyline');
    }
  }
  if (action === 'toggle-dimensions') {
    const visible = !getDimensionLayer(documentModel).visible;
    message = `Dimensions layer ${visible ? 'shown' : 'hidden'}`;
    commit(setDimensionLayerVisibility(documentModel, visible), 'Toggle Dimensions layer');
  }
  if (action === 'toggle-railing-visibility') {
    const visible = !getRailingLayer(documentModel).visible;
    message = `Railing layer ${visible ? 'shown' : 'hidden'}`;
    commit(setRailingLayerVisibility(documentModel, visible), 'Toggle Railing layer');
  }
  if (action === 'cat-tool-line') {
    catTool = 'line';
    catDraft = null;
    catPointer = null;
    setMode('cat');
    return;
  }
  if (action === 'cat-tool-measure') {
    catTool = 'measure';
    catDraft = null;
    catPointer = null;
    setMode('cat');
    return;
  }
  if (['cat-tool-offset', 'cat-tool-trim', 'cat-tool-extend', 'cat-tool-note'].includes(action)) {
    catTool = action.replace('cat-tool-', '');
    catDraft = null;
    catPointer = null;
    numericBuffer = '';
    setMode('cat');
    return;
  }
  if (action === 'apply-cat-note' && selected.kind === 'cat') {
    const note = getCatNotes(documentModel).find((entry) => entry.id === selected.id);
    if (!note) return;
    const text = app.querySelector('#cat-note-text')?.value ?? '';
    message = 'CAT Note updated';
    commit(upsertObject(documentModel, updateCatNote(note, { text })), 'Edit CAT construction note');
  }
  if (action === 'record-cat-note-audio' && selected.kind === 'cat') { startCatNoteRecording(selected.id); return; }
  if (action === 'stop-cat-note-audio') { stopCatNoteRecording(); return; }
  if (action === 'remove-cat-note-audio' && selected.kind === 'cat') {
    const note = getCatNotes(documentModel).find((entry) => entry.id === selected.id);
    if (!note) return;
    message = 'Voice note removed';
    commit(upsertObject(documentModel, updateCatNote(note, { audioDataUrl: null })), 'Remove CAT voice note');
  }
  if (action === 'toggle-cat-dimensions') {
    const visible = !getCatDimensionLayer(documentModel).visible;
    message = `CAT dimensions ${visible ? 'shown' : 'hidden'}`;
    commit(setCatDimensionLayerVisibility(documentModel, visible), 'Toggle CAT dimensions');
  }
  if (action === 'close-cat-tool') {
    catDraft = null;
    catPointer = null;
    mode = 'select';
    message = 'CAT CL closed · reference geometry remains available for snap';
    render();
    return;
  }
  if (action === 'delete-cat-object' && selected.kind === 'cat') {
    const removed = documentModel.objects.find((object) => object.id === selected.id);
    if (!removed) return;
    const next = { ...documentModel, objects: documentModel.objects.filter((object) => object.id !== selected.id) };
    selected = { kind: null, id: null };
    message = removed.type === CAT_NOTE_TYPE ? 'CAT Note removed' : removed.type === CAT_MEASUREMENT_TYPE ? 'CAT measurement removed' : 'CAT construction line removed';
    commit(next, 'Delete CAT object');
  }
  if (action === 'toggle-cat-construction-lines') {
    const visible = !getCatConstructionLayer(documentModel).visible;
    message = `CAT construction lines ${visible ? 'shown' : 'hidden'}`;
    commit(setCatConstructionLayerVisibility(documentModel, visible), 'Toggle CAT construction lines');
  }
  if (action === 'edit-dimension' && selected.kind === 'dimension') editDimensionReference(selected.id);
  if (action === 'reset-dimension-position' && selected.kind === 'dimension') {
    message = 'Dimension label returned to its default position';
    commit(setDimensionOffset(documentModel, selected.id, { x: 0, y: 0 }), 'Reset dimension annotation');
  }
  if (action === 'remove-railing' && selected.kind === 'railing') removeSelectedRailing();
  if (action === 'undo') { documentModel = history.undo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Undid last change'; render(); }
  if (action === 'redo') { documentModel = history.redo(documentModel); persist(); selected = { kind: null, id: null }; message = 'Redid change'; render(); }
  if (action === 'delete-vertex' && selected.kind === 'vertex') {
    if (isVertexReferencedByAttachment(selected.id)) { message = 'This corner anchors an attached construction object and cannot be removed yet'; render(); }
    else { try { commitBoundary(markBoundaryEdited(removeVertex(boundary(), selected.id)), 'Remove boundary corner'); selected = { kind: null, id: null }; message = 'Corner removed'; } catch (error) { message = error.message; render(); } }
  }
  if (action === 'new-boundary') {
    const next = { ...documentModel, objects: documentModel.objects.filter((object) => !['deck-boundary', 'stair', 'railing-run', 'level-down'].includes(object.type)) };
    commit(next, 'Remove deck boundary'); selected = { kind: null, id: null }; mode = 'select'; message = 'Ready for a new boundary';
  }
  if (action === 'advance-stage') {
    const progress = deriveModelProgress(documentModel);
    if (progress.nextStage.id !== progress.stage.id) {
      message = `Project advanced to ${progress.nextStage.label}`;
      commit(setProjectWorkflowStage(documentModel, progress.nextStage.id), `Advance project to ${progress.nextStage.label}`);
    }
  }
  if (action === 'fit-project') fitProject();
  if (action === 'toggle-visibility-panel') { utilityPanel = utilityPanel === 'visibility' ? null : 'visibility'; render(); }
  if (action === 'toggle-snap-panel') { utilityPanel = utilityPanel === 'snap' ? null : 'snap'; render(); }
  if (action === 'close-utility-panel') { utilityPanel = null; render(); }
  if (action === 'toggle-inspector') {
    utilityPanel = null;
    app.querySelector('.utility-popover')?.remove();
    app.querySelectorAll('[data-action="toggle-visibility-panel"], [data-action="toggle-snap-panel"]').forEach((button) => button.classList.remove('active'));
    app.querySelector('.inspector')?.classList.toggle('open');
  }
}

function resetProjectWorkspaceState() {
  selected = { kind: null, id: null };
  activeBoundaryId = null;
  mode = 'select';
  draft = [];
  stairDraft = null;
  railingDraft = null;
  levelDownDraft = [];
  catDraft = null;
  catPointer = null;
  framingDraft = null;
  framingGesture = null;
  joistTargetBoundaryId = null;
  framingNodeGesture = null;
  joistMeshMoveMode = null;
  joistMeshMoveGesture = null;
  singleJoistMode = null;
  blockingAddMode = null;
  blockingMoveMode = null;
  blockingMoveGesture = null;
  framingTool = 'joist';
  framingSpacing = DEFAULT_SPACING_INCHES;
  framingCopies = DEFAULT_COPIES;
  catNoteDragStart = null;
  catArchMode = null;
  catArchGesture = null;
  catArchDraft = null;
  lastCatOffsetDistance = null;
  catSnapState = { type: 'none', label: 'Free', guides: [] };
  utilityPanel = null;
  exportMenuOpen = false;
  takeoffOpen = false;
  takeoffAddCategory = null;
  pendingDeckDeleteId = null;
  viewport = createViewport();
}

function stepOnePayload() {
  const railingRuns = getAllRailingGeometries().map((geometry) => ({
    id: geometry.railing.id,
    system: geometry.railing.settings?.system ?? 'unassigned',
    lengthInches: geometry.length,
  }));
  return createSalesHubStepOnePayload(documentModel, {
    opportunityId: salesHubLaunch.opportunityId,
    railingRuns,
  });
}

function downloadJson(payload, suffix) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${documentModel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function saveToStepOne() {
  const payload = stepOnePayload();
  const target = window.opener ?? (window.parent !== window ? window.parent : null);
  if (salesHubLaunch.connected && target) {
    target.postMessage(createSalesHubStepOneMessage(payload), salesHubLaunch.targetOrigin);
    message = 'Decking, railing, stairs, and sketch reference sent to Step 1';
  } else {
    downloadJson(payload, 'step-1');
    message = 'Step 1 JSON downloaded · direct Sales Hub connection is ready for a future launch context';
  }
  exportMenuOpen = false;
  render();
}

function downloadStepOneJson() {
  downloadJson(stepOnePayload(), 'step-1');
  exportMenuOpen = false;
  message = 'Step 1 JSON downloaded';
  render();
}

function exportProjectPdf() {
  exportMenuOpen = false;
  projectMenuOpen = false;
  fitProject();
  message = 'PDF layout ready';
  window.setTimeout(() => window.print(), 80);
  render();
}

function printTakeoff(includePrices) {
  takeoffExpanded = new Set(TAKEOFF_CATEGORIES.map((category) => category.id));
  render();
  document.body.classList.add('print-takeoff');
  document.body.classList.toggle('takeoff-no-prices', !includePrices);
  message = `${takeoffViewMode === 'consolidated' ? 'Consolidated purchase list' : 'Detailed Takeoff'} ready ${includePrices ? 'with prices' : 'for supplier quote without prices'}`;
  window.setTimeout(() => window.print(), 80);
}

window.addEventListener('afterprint', () => document.body.classList.remove('print-takeoff', 'takeoff-no-prices'));

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
}

function updateHud(event) {
  const hud = app.querySelector('.cursor-hud');
  const drawingBoundary = mode === 'draw' && draft.length && pointerWorld;
  const drawingCatLine = mode === 'cat' && catTool === 'line' && catDraft?.start && catPointer;
  const drawingCatOffset = mode === 'cat' && catTool === 'offset' && catDraft?.sourceLineId && catPointer;
  if (!hud || (!drawingBoundary && !drawingCatLine && !drawingCatOffset)) { hideHud(); return; }
  const panel = app.querySelector('.canvas-panel').getBoundingClientRect();
  hud.style.left = `${Math.min(panel.width - 180, event.clientX - panel.left + 18)}px`;
  hud.style.top = `${Math.min(panel.height - 120, event.clientY - panel.top + 18)}px`;
  hud.classList.add('visible');
  const sourceOffsetLine = drawingCatOffset ? getCatLines(documentModel).find((line) => line.id === catDraft.sourceLineId) : null;
  const typedOffset = drawingCatOffset && numericBuffer ? parseConstructionLength(numericBuffer) : null;
  const liveOffset = sourceOffsetLine ? deriveCatOffset(sourceOffsetLine, catPointer) : null;
  const effectiveOffset = typedOffset > 0 ? typedOffset : lastCatOffsetDistance ?? liveOffset?.distance;
  const anchor = drawingCatLine ? catDraft.start : drawingCatOffset ? sourceOffsetLine.vertices[0] : draft[draft.length - 1];
  const activePoint = drawingCatLine || drawingCatOffset ? catPointer : pointerWorld;
  const activeSnap = drawingCatLine ? catSnapState : snapState;
  const dx = activePoint.x - anchor.x;
  const dy = activePoint.y - anchor.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  hud.querySelector('[data-hud-length-label]').textContent = drawingCatOffset ? 'Offset' : 'Length';
  hud.querySelector('[data-hud-length]').textContent = drawingCatOffset ? formatFeetInches(effectiveOffset || 0) : formatFeetInches(Math.hypot(dx, dy));
  const sourceGeometry = sourceOffsetLine ? deriveCatLineGeometry(sourceOffsetLine) : null;
  hud.querySelector('[data-hud-angle-label]').textContent = drawingCatOffset && sourceGeometry?.kind === 'arc' ? 'New radius' : drawingCatOffset ? 'Side' : 'Angle';
  hud.querySelector('[data-hud-angle]').textContent = drawingCatOffset ? sourceGeometry?.kind === 'arc' ? formatFeetInches(Math.max(.5, sourceGeometry.radius + (liveOffset?.sign ?? 1) * (effectiveOffset || 0))) : liveOffset?.sign < 0 ? 'Right' : 'Left' : `${Math.round(angle)}°`;
  hud.querySelector('[data-hud-snap]').textContent = drawingCatOffset ? lastCatOffsetDistance ? 'Repeat Offset' : 'Live Offset' : activeSnap.label;
  const input = hud.querySelector('[data-hud-input]');
  input.textContent = numericBuffer || (drawingCatOffset ? 'Type Offset distance · Enter' : 'Type a length · Enter');
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
  hud.querySelector('[data-stair-live-rise]').textContent = options?.totalRise ? formatFeetInches(options.totalRise, .25) : '0″';
  hud.querySelector('[data-stair-live-risers]').textContent = options?.riserCount || '—';
  hud.querySelector('[data-stair-live-treads]').textContent = options?.treadCount || '—';
  hud.querySelector('[data-stair-live-riser]').textContent = options?.riserHeight ? formatInches(options.riserHeight) : '—';
  hud.querySelector('[data-stair-live-tread]').textContent = options?.treadDepth ? formatInches(options.treadDepth) : '—';
  hud.querySelector('[data-stair-live-run]').textContent = options?.totalRun ? formatFeetInches(options.totalRun, .25) : '—';
  hud.querySelector('[data-stair-live-status]').textContent = options?.destination
    ? 'VALID LANDING · LOWER DECK'
    : options?.usesExtendedRiserRange
      ? 'EXTENDED 5″–6″ RISER RANGE · REVIEW'
      : 'Release to build · 5″–7.5″ risers · 10″–11″ treads';
}

function updateStatusMessage() {
  const status = app.querySelector('.status-pill');
  if (status) status.textContent = message;
}

function audioBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function startCatNoteRecording(noteId) {
  const note = getCatNotes(documentModel).find((entry) => entry.id === noteId);
  if (!note || catAudioRecorder) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    message = 'Voice recording is not available in this browser';
    render();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    const recorder = new MediaRecorder(stream, { ...(preferredType ? { mimeType: preferredType } : {}), audioBitsPerSecond: 32000 });
    recorder.noteId = noteId;
    recorder.stream = stream;
    catAudioChunks = [];
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) catAudioChunks.push(event.data); });
    recorder.addEventListener('stop', async () => {
      window.clearTimeout(recorder.stopTimer);
      recorder.stream.getTracks().forEach((track) => track.stop());
      const current = getCatNotes(documentModel).find((entry) => entry.id === recorder.noteId);
      const blob = new Blob(catAudioChunks, { type: recorder.mimeType || 'audio/webm' });
      catAudioRecorder = null;
      catAudioChunks = [];
      if (!current || !blob.size) { message = 'Voice recording canceled'; render(); return; }
      try {
        const audioDataUrl = await audioBlobToDataUrl(blob);
        message = 'Voice note saved';
        commit(upsertObject(documentModel, updateCatNote(current, { audioDataUrl })), 'Record CAT voice note');
      } catch { message = 'Voice note could not be saved'; render(); }
    });
    catAudioRecorder = recorder;
    recorder.start();
    recorder.stopTimer = window.setTimeout(() => stopCatNoteRecording(), 30000);
    message = 'Recording voice note · press Stop when finished';
    render();
  } catch {
    catAudioRecorder = null;
    message = 'Microphone access was not granted';
    render();
  }
}

function stopCatNoteRecording() {
  if (catAudioRecorder?.state === 'recording') catAudioRecorder.stop();
}

function acceptNumericLength() {
  const catLineActive = mode === 'cat' && catTool === 'line' && catDraft?.start;
  const catOffsetActive = mode === 'cat' && catTool === 'offset' && catDraft?.sourceLineId && catPointer;
  if ((!draft.length && !catLineActive && !catOffsetActive) || !numericBuffer) return false;
  if (catOffsetActive) { placeCatPoint(catPointer); return true; }
  const length = parseConstructionLength(numericBuffer);
  if (!length || length <= 0) { message = 'Use a length such as 12\', 144 in, or 3658 mm'; render(); return true; }
  const anchor = catLineActive ? catDraft.start : draft[draft.length - 1];
  const toward = catLineActive ? catPointer : pointerWorld;
  const exactPoint = resolveCatLineEndpoint(anchor, toward ?? { x: anchor.x + 1, y: anchor.y }, length);
  if (catLineActive) {
    const object = createCatLine(anchor, exactPoint);
    catDraft = { start: exactPoint };
    catPointer = exactPoint;
    catSnapState = { type: 'angle', label: 'Exact length', guides: [] };
    lastLength = length;
    numericBuffer = '';
    message = `${formatFeetInches(length)} CAT Line placed · continue drawing`;
    commit(upsertObject(documentModel, object), 'Add exact-length CAT construction line');
    return true;
  }
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

function repeatLastCatSegment() {
  if (!lastLength || !catDraft?.start) return;
  const anchor = catDraft.start;
  const toward = catPointer ?? { x: anchor.x + 1, y: anchor.y };
  const endpoint = resolveCatLineEndpoint(anchor, toward, lastLength);
  const object = createCatLine(anchor, endpoint);
  catDraft = { start: endpoint };
  catPointer = endpoint;
  message = `${formatFeetInches(lastLength)} CAT Line repeated`;
  commit(upsertObject(documentModel, object), 'Repeat CAT construction line');
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && archMode) {
    event.preventDefault(); archMode = null; archGesture = null; archDraft = null;
    message = 'Arch line canceled'; render(); return;
  }
  if (event.key === 'Escape' && catArchMode) {
    event.preventDefault(); catArchMode = null; catArchGesture = null; catArchDraft = null; message = 'CAT Arch line canceled'; render(); return;
  }
  const modifier = event.ctrlKey || event.metaKey;
  const editingField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  const numericLineMode = mode === 'draw' || (mode === 'cat' && ((catTool === 'line' && Boolean(catDraft?.start)) || (catTool === 'offset' && Boolean(catDraft?.sourceLineId))));
  if (event.key === 'Escape' && (joistMeshMoveMode || joistMeshMoveGesture || singleJoistMode || blockingAddMode || blockingMoveMode || blockingMoveGesture)) {
    event.preventDefault();
    if (joistMeshMoveGesture) documentModel = joistMeshMoveGesture.document;
    joistMeshMoveMode = null;
    joistMeshMoveGesture = null;
    singleJoistMode = null;
    if (blockingMoveGesture) documentModel = blockingMoveGesture.document;
    blockingAddMode = null;
    blockingMoveMode = null;
    blockingMoveGesture = null;
    message = 'Joist Field edit canceled';
    persist();
    render();
    return;
  }
  if (event.key === 'Escape' && mode === 'framing') {
    event.preventDefault();
    if (framingDraft || framingGesture) {
      framingDraft = null;
      framingGesture = null;
      pointerWorld = null;
      message = 'Framing run canceled · choose the first endpoint';
    } else {
      mode = 'select';
      joistTargetBoundaryId = null;
      message = 'Framing tool closed';
    }
    render();
    return;
  }
  if (event.key === 'Escape' && takeoffOpen) {
    event.preventDefault();
    takeoffOpen = false;
    takeoffAddCategory = null;
    message = 'Takeoff saved with this project';
    render();
    return;
  }
  if (event.key === 'Escape' && (projectMenuOpen || exportMenuOpen)) {
    event.preventDefault();
    projectMenuOpen = false;
    exportMenuOpen = false;
    pendingProjectDeleteId = null;
    render();
    return;
  }
  if (event.key === 'Escape' && utilityPanel) {
    event.preventDefault();
    utilityPanel = null;
    render();
    return;
  }
  if (event.key === 'Escape' && boardingDirectionMode) {
    event.preventDefault();
    boardingDirectionMode = null;
    message = 'Board direction selection canceled';
    render();
    return;
  }
  if (event.key === 'Escape' && moveBoundaryMode) {
    event.preventDefault();
    if (moveBoundaryGesture) documentModel = moveBoundaryGesture.document;
    moveBoundaryMode = null; moveBoundaryGesture = null;
    message = 'Deck area move canceled';
    persist(); render();
    return;
  }
  if (event.key === 'Escape' && chamferMode) {
    event.preventDefault();
    chamferMode = null; chamferGesture = null; chamferDraft = null;
    message = 'Chamfer canceled';
    render();
    return;
  }
  if (event.key === 'Escape' && dimensionLeaderMode) {
    event.preventDefault();
    dimensionLeaderMode = null;
    dimensionLeaderGesture = null;
    message = 'Arrow reposition canceled';
    render();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); handleAction(event.shiftKey ? 'redo' : 'undo'); }
  if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); handleAction('redo'); }
  if (!modifier && !editingField && !numericLineMode && event.key.toLowerCase() === 'e') {
    event.preventDefault();
    const enabled = !getSnapSettings(documentModel).edges;
    message = `Edge and corner snap ${enabled ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { edges: enabled }), 'Toggle edge snap');
    return;
  }
  if (!modifier && !editingField && !numericLineMode && event.key.toLowerCase() === 'g') {
    event.preventDefault();
    const enabled = !getSnapSettings(documentModel).grid;
    message = `Grid snap ${enabled ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { grid: enabled }), 'Toggle grid snap');
    return;
  }
  if (!modifier && !editingField && !numericLineMode && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    const enabled = !getSnapSettings(documentModel).nodeInference;
    message = `Node inference ${enabled ? 'enabled' : 'disabled'}`;
    commit(setSnapSettings(documentModel, { nodeInference: enabled }), 'Toggle node inference');
    return;
  }
  if (numericLineMode && !modifier && !editingField && /^[0-9a-z.'"\-]$/i.test(event.key)) {
    if (event.key.toLowerCase() === 'r' && !numericBuffer && !(mode === 'cat' && catTool === 'offset')) { event.preventDefault(); mode === 'cat' ? repeatLastCatSegment() : repeatLastSegment(); return; }
    event.preventDefault(); numericBuffer += event.key; message = 'Enter an exact segment length'; updateHudFromKeyboard(); return;
  }
  if (numericLineMode && event.key === 'Backspace' && numericBuffer) { event.preventDefault(); numericBuffer = numericBuffer.slice(0, -1); updateHudFromKeyboard(); return; }
  if (event.key === 'Enter' && numericLineMode) { event.preventDefault(); if (!acceptNumericLength() && mode === 'draw') completeDraft(); }
  if (event.key === ' ' && numericLineMode) { event.preventDefault(); if (numericBuffer) { numericBuffer += ' '; updateHudFromKeyboard(); } else mode === 'cat' ? repeatLastCatSegment() : repeatLastSegment(); }
  if (event.key === 'Tab' && numericLineMode) { event.preventDefault(); message = numericBuffer ? 'Press Enter to accept length' : 'Type a dimension in feet, inches, millimeters, or meters'; updateHudFromKeyboard(); }
  if (event.key === 'Escape' && mode === 'draw') {
    event.preventDefault();
    if (numericBuffer) numericBuffer = '';
    else if (draft.length) draft.pop();
    else mode = 'select';
    pointerWorld = draft.at(-1) ?? null;
    message = mode === 'draw' ? 'Last sketch step canceled' : 'Drawing canceled'; render();
  }
  if (event.key === 'Escape' && mode === 'cat') {
    event.preventDefault();
    if (numericBuffer) {
      numericBuffer = '';
      message = 'Exact CAT length entry cleared';
    } else if (catDraft?.start || catDraft?.sourceLineId || catDraft?.extendSourceId) {
      catDraft = null;
      catPointer = null;
      message = catTool === 'offset' ? 'Offset · choose a CAT Line or arc' : catTool === 'extend' ? 'Extend · select the CAT Line or arc to extend' : `${catTool === 'measure' ? 'Measuring tape' : 'CAT Line'} · choose the first point`;
    } else {
      mode = 'select';
      message = 'CAT CL closed';
    }
    render();
    return;
  }
  if (event.key === 'Escape' && mode === 'level-down') {
    event.preventDefault();
    if (levelDownDraft.length) levelDownDraft.pop();
    else mode = 'select';
    levelDownPointer = levelDownDraft.at(-1) ?? null;
    message = mode === 'level-down' ? 'Last Level Down point canceled' : 'Level Down canceled';
    render();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.kind === 'framing' && !editingField) {
    event.preventDefault();
    handleAction('delete-framing');
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.kind === 'blocking' && !editingField) {
    const row = deriveJoistBlockingRows(documentModel, { includeSuppressed: true }).find((entry) => entry.id === selected.id);
    if (row && !row.automatic) { event.preventDefault(); handleAction('delete-blocking-row'); }
  }
  if (event.key === 'Backspace' && mode === 'level-down' && !editingField) {
    event.preventDefault();
    levelDownDraft.pop(); levelDownPointer = levelDownDraft.at(-1) ?? null;
    message = levelDownDraft.length ? 'Last Level Down point removed' : 'Choose a boundary edge to restart';
    render();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected.kind === 'vertex') handleAction('delete-vertex');
});

function updateHudFromKeyboard() {
  const hud = app.querySelector('.cursor-hud');
  if (!hud) return;
  const input = hud.querySelector('[data-hud-input]');
  input.textContent = numericBuffer || (mode === 'cat' && catTool === 'offset' ? 'Type Offset distance · Enter' : 'Type a length · Enter');
  input.classList.toggle('active', Boolean(numericBuffer));
}

render();
