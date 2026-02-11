/* Tactical diagram tool for Diagram doctype */
/* global frappe, fabric */

(function () {
	// Lazily load fabric.js from CDN if not already present
	const loadFabric = () =>
		new Promise((resolve, reject) => {
			if (window.fabric) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.src = "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js";
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("Failed to load fabric.js"));
			document.head.appendChild(script);
		});

	const CANVAS_MARGIN = 12;

	frappe.ui.form.on("Diagram", {
		refresh(frm) {
			if (!frm.fields_dict.canvas_html) {
				return;
			}
			render_canvas(frm);
		},
		pitch_type(frm) {
			render_canvas(frm);
		},
		orientation(frm) {
			render_canvas(frm);
		},
		before_save(frm) {
			if (frm._diagram_canvas) {
				frm.set_value("diagram_json", JSON.stringify(frm._diagram_canvas.toJSON(["isBackground"])));
			}
		},
	});

	async function render_canvas(frm) {
		await loadFabric().catch(() => {
			frappe.msgprint("Unable to load the drawing engine (fabric.js). Check your network connection.");
		});
		if (!window.fabric) {
			return;
		}

		const previousSize = frm._diagram_canvas
			? { w: frm._diagram_canvas.getWidth(), h: frm._diagram_canvas.getHeight() }
			: null;
		if (frm._diagram_canvas) {
			// preserve current work before re-render (e.g., when pitch/orientation changes)
			frm.doc.diagram_json = JSON.stringify(frm._diagram_canvas.toJSON(["isBackground"]));
			frm._diagram_canvas.dispose();
			frm._diagram_canvas = null;
		}

		const wrapper = $(frm.fields_dict.canvas_html.wrapper);
		wrapper.empty();
		wrapper.append(build_toolbar_html());
		const canvasId = `diagram-canvas-${frm.docname || Math.floor(Math.random() * 1e6)}`;

		const { width, height } = get_canvas_dimensions(frm);
		wrapper.append(
			`<canvas id="${canvasId}" width="${width}" height="${height}" style="border:1px solid #d0d7de;border-radius:6px;display:block;margin-top:8px;"></canvas>`
		);

		if (frm._diagram_canvas) {
			frm._diagram_canvas.dispose();
			frm._diagram_canvas = null;
		}

		const canvas = new fabric.Canvas(canvasId, {
			preserveObjectStacking: true,
			selection: true,
		});
		frm._diagram_canvas = canvas;

		const didRestore = restore_diagram_if_any(
			frm,
			canvas,
			width,
			height,
			previousSize,
			() =>
				draw_pitch_background(
					canvas,
					width,
					height,
					frm.doc.pitch_type || "Full",
					frm.doc.orientation || "Horizontal"
				)
		);
		if (!didRestore) {
			draw_pitch_background(
				canvas,
				width,
				height,
				frm.doc.pitch_type || "Full",
				frm.doc.orientation || "Horizontal"
			);
		}
		setup_toolbar_actions(frm, canvas);
		canvas.renderAll();
	}

	function get_canvas_dimensions(frm) {
		const orientation = frm.doc.orientation || "Horizontal";
		const pitchType = frm.doc.pitch_type || "Full";

		const base = {
			Full: { w: 900, h: 600 },
			Half: { w: 450, h: 600 },
			Third: { w: 300, h: 600 },
			Custom: { w: 900, h: 600 },
		}[pitchType] || { w: 900, h: 600 };

		return orientation === "Vertical" ? { width: base.h, height: base.w } : { width: base.w, height: base.h };
	}

	function draw_pitch_background(canvas, width, height, pitchType, orientation) {
		canvas.setBackgroundColor("#0b8d2f", canvas.renderAll.bind(canvas));

		const left = CANVAS_MARGIN;
		const top = CANVAS_MARGIN;
		const fieldWidth = width - CANVAS_MARGIN * 2;
		const fieldHeight = height - CANVAS_MARGIN * 2;
		const isVertical = orientation === "Vertical";
		const fieldLength = isVertical ? fieldHeight : fieldWidth;
		const fieldBreadth = isVertical ? fieldWidth : fieldHeight;
		const lengthScale = pitchType === "Half" ? 2 : pitchType === "Third" ? 3 : 1;
		const fullLength = fieldLength * lengthScale;
		const fullBreadth = fieldBreadth;

		const addPitchObj = (obj, sendToBack = false) => {
			obj.selectable = false;
			obj.evented = false;
			obj.isBackground = true;
			canvas.add(obj);
			if (sendToBack) {
				canvas.sendToBack(obj);
			}
		};

		const addLine = (x1, y1, x2, y2) =>
			addPitchObj(
				new fabric.Line([x1, y1, x2, y2], {
					stroke: "#ffffff",
					strokeWidth: 2,
				})
			);

		const addRect = (x, y, w, h, fill = "", sendToBack = false) =>
			addPitchObj(
				new fabric.Rect({
					left: x,
					top: y,
					width: w,
					height: h,
					fill,
					stroke: fill ? "" : "#ffffff",
					strokeWidth: fill ? 0 : 2,
				}),
				sendToBack
			);

		const addCircle = (cx, cy, r) =>
			addPitchObj(
				new fabric.Circle({
					left: cx - r,
					top: cy - r,
					radius: r,
					fill: "",
					stroke: "#ffffff",
					strokeWidth: 2,
				})
			);

		const addSpot = (cx, cy, r = 3) =>
			addPitchObj(
				new fabric.Circle({
					left: cx - r,
					top: cy - r,
					radius: r,
					fill: "#ffffff",
					stroke: "#ffffff",
					strokeWidth: 1,
				})
			);

		const mapPoint = (u, v) => ({
			x: isVertical ? left + v : left + u,
			y: isVertical ? top + u : top + v,
		});

		const rectFromUV = (u1, v1, u2, v2) => {
			const p1 = mapPoint(u1, v1);
			const p2 = mapPoint(u2, v2);
			return {
				x: Math.min(p1.x, p2.x),
				y: Math.min(p1.y, p2.y),
				w: Math.abs(p2.x - p1.x),
				h: Math.abs(p2.y - p1.y),
			};
		};

		// Stripes (vertical bands along pitch length)
		const stripeCount = 12;
		for (let i = 0; i < stripeCount; i += 1) {
			const uStart = (fieldLength / stripeCount) * i;
			const uEnd = (fieldLength / stripeCount) * (i + 1);
			const stripe = rectFromUV(uStart, 0, uEnd, fieldBreadth);
			const color = i % 2 === 0 ? "#0b8d2f" : "#0a7a2a";
			addRect(stripe.x, stripe.y, stripe.w, stripe.h, color, true);
		}

		// Border
		addRect(left, top, fieldWidth, fieldHeight);

		const penaltyDepth = fullLength * 0.16;
		const penaltyWidth = fullBreadth * 0.6;
		const goalDepth = fullLength * 0.05;
		const goalWidth = fullBreadth * 0.27;
		const penaltySpotDistance = fullLength * 0.105;
		const centerCircleRadius = fullBreadth * 0.134;

		const drawPenaltyArea = (goalU, direction) => {
			const boxUStart = direction === 1 ? goalU : goalU - penaltyDepth;
			const goalBoxUStart = direction === 1 ? goalU : goalU - goalDepth;
			const vStart = (fieldBreadth - penaltyWidth) / 2;
			const goalVStart = (fieldBreadth - goalWidth) / 2;

			const penaltyRect = rectFromUV(boxUStart, vStart, boxUStart + penaltyDepth, vStart + penaltyWidth);
			const goalRect = rectFromUV(goalBoxUStart, goalVStart, goalBoxUStart + goalDepth, goalVStart + goalWidth);
			addRect(penaltyRect.x, penaltyRect.y, penaltyRect.w, penaltyRect.h);
			addRect(goalRect.x, goalRect.y, goalRect.w, goalRect.h);

			const spot = mapPoint(goalU + direction * penaltySpotDistance, fieldBreadth / 2);
			addSpot(spot.x, spot.y);
		};

		const addArcUV = (u, v, r, startAngle, endAngle) => {
			let delta = endAngle - startAngle;
			if (delta < 0) {
				delta += Math.PI * 2;
			}
			const segments = 24;
			const points = [];
			for (let i = 0; i <= segments; i += 1) {
				const angle = startAngle + (delta * i) / segments;
				const p = mapPoint(u + r * Math.cos(angle), v + r * Math.sin(angle));
				points.push({ x: p.x, y: p.y });
			}
			addPitchObj(
				new fabric.Polyline(points, {
					fill: "",
					stroke: "#ffffff",
					strokeWidth: 2,
					strokeLineCap: "round",
					strokeLineJoin: "round",
				})
			);
		};

		const addCornerArc = (corner) => {
			const r = Math.min(fieldBreadth, fieldLength) * 0.04;
			let cx = 0;
			let cy = 0;
			let start = 0;
			let end = 0;

			if (corner === "top-left") {
				cx = 0;
				cy = 0;
				start = 0;
				end = Math.PI / 2;
			} else if (corner === "top-right") {
				cx = fieldLength;
				cy = 0;
				start = Math.PI / 2;
				end = Math.PI;
			} else if (corner === "bottom-right") {
				cx = fieldLength;
				cy = fieldBreadth;
				start = Math.PI;
				end = Math.PI * 1.5;
			} else if (corner === "bottom-left") {
				cx = 0;
				cy = fieldBreadth;
				start = Math.PI * 1.5;
				end = Math.PI * 2;
			}

			addArcUV(cx, cy, r, start, end);
		};

		const addGoal = (goalU, direction) => {
			const maxDepth = Math.max(6, CANVAS_MARGIN - 2);
			const depth = Math.min(fullLength * 0.03, maxDepth);
			const width = fullBreadth * 0.18;
			const vStart = (fieldBreadth - width) / 2;
			const goalRect = rectFromUV(goalU, vStart, goalU + direction * depth, vStart + width);
			addRect(goalRect.x, goalRect.y, goalRect.w, goalRect.h);
		};

		const addPenaltyArc = (goalU, direction) => {
			const arcCenterU = goalU + direction * penaltySpotDistance;
			const arcRadius = fullLength * 0.0915;
			const lineU = goalU + direction * penaltyDepth;
			const d = Math.abs(lineU - arcCenterU);
			if (!arcRadius || d >= arcRadius) {
				return;
			}
			const theta = Math.acos(d / arcRadius);
			const start = direction === 1 ? -theta : Math.PI - theta;
			const end = direction === 1 ? theta : Math.PI + theta;
			addArcUV(arcCenterU, fieldBreadth / 2, arcRadius, start, end);
		};

		if (pitchType === "Full" || pitchType === "Custom") {
			// Mid line and center circle
			const midStart = mapPoint(fieldLength / 2, 0);
			const midEnd = mapPoint(fieldLength / 2, fieldBreadth);
			addLine(midStart.x, midStart.y, midEnd.x, midEnd.y);

			const center = mapPoint(fieldLength / 2, fieldBreadth / 2);
			addCircle(center.x, center.y, centerCircleRadius);
			addSpot(center.x, center.y, 2.5);

			drawPenaltyArea(0, 1);
			drawPenaltyArea(fieldLength, -1);
			addPenaltyArc(0, 1);
			addPenaltyArc(fieldLength, -1);
			addGoal(0, -1);
			addGoal(fieldLength, 1);
			addCornerArc("top-left");
			addCornerArc("top-right");
			addCornerArc("bottom-right");
			addCornerArc("bottom-left");
		} else if (pitchType === "Half") {
			drawPenaltyArea(0, 1);
			addArcUV(fieldLength, fieldBreadth / 2, centerCircleRadius, Math.PI / 2, Math.PI * 1.5);
			addPenaltyArc(0, 1);
			addGoal(0, -1);
			addCornerArc("top-left");
			addCornerArc("bottom-left");
		} else if (pitchType === "Third") {
			drawPenaltyArea(0, 1);
			addPenaltyArc(0, 1);
			addGoal(0, -1);
			addCornerArc("top-left");
			addCornerArc("bottom-left");
		}

	}

	function build_toolbar_html() {
		return `
<div class="diagram-toolbar" style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;">
  <div style="display:grid;grid-template-columns:repeat(2, max-content);gap:8px 16px;align-items:start;">
    <button class="btn btn-sm btn-secondary" data-action="select" title="Select/Move" aria-label="Select/Move">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 2 L12 8 L8.5 9 L11.5 14 L9.8 14.7 L7 9.8 L4.5 12 Z" fill="currentColor"/>
      </svg>
      <span style="margin-left:6px;">Select</span>
    </button>

    <div style="display:flex;gap:6px;align-items:center;">
      <button class="btn btn-sm btn-secondary" data-action="player" title="Player" aria-label="Player">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="4.5" r="3" fill="currentColor"/>
          <path d="M2.5 14c1.5-3 9.5-3 11 0" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        <span style="margin-left:6px;">Player</span>
      </button>
      <select class="input-sm" data-select="player-color">
        <option value="#2563eb">Blue</option>
      <option value="#dc2626">Red</option>
      <option value="#f97316">Orange</option>
      <option value="#facc15">Yellow</option>
      <option value="#9333ea">Purple</option>
      <option value="#0ea5e9">Sky</option>
      <option value="#ec4899">Pink</option>
      <option value="#a855f7">Violet</option>
      <option value="#a16207">Brown</option>
        <option value="#8b5cf6">Indigo</option>
      </select>
    </div>

    <button class="btn btn-sm btn-secondary" data-action="add-ball" title="Ball" aria-label="Ball">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <polygon points="8,3.2 10.6,4.8 9.7,7.6 6.3,7.6 5.4,4.8" fill="currentColor"/>
        <path d="M5.4 4.8 L3.2 6.2 L4.2 9" stroke="currentColor" stroke-width="1" fill="none"/>
        <path d="M10.6 4.8 L12.8 6.2 L11.8 9" stroke="currentColor" stroke-width="1" fill="none"/>
        <path d="M6.3 7.6 L5.2 10.6 L8 12.6 L10.8 10.6 L9.7 7.6" stroke="currentColor" stroke-width="1" fill="none"/>
      </svg>
      <span style="margin-left:6px;">Ball</span>
    </button>

    <div style="display:flex;gap:6px;align-items:center;">
      <button class="btn btn-sm btn-secondary" data-action="cone" title="Cone" aria-label="Cone">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2 L14 14 H2 Z" fill="currentColor"/>
        </svg>
        <span style="margin-left:6px;">Cone</span>
      </button>
      <select class="input-sm" data-select="cone-color">
        <option value="#f97316">Orange</option>
        <option value="#facc15">Yellow</option>
      </select>
    </div>

    <div style="display:flex;gap:6px;align-items:center;">
      <button class="btn btn-sm btn-secondary" data-action="marker" title="Marker" aria-label="Marker">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <circle cx="8" cy="8" r="2" fill="currentColor"/>
        </svg>
        <span style="margin-left:6px;">Marker</span>
      </button>
      <select class="input-sm" data-select="marker-color">
        <option value="#facc15">Yellow</option>
        <option value="#dc2626">Red</option>
        <option value="#2563eb">Blue</option>
        <option value="#f97316">Orange</option>
      </select>
    </div>

    <div style="display:flex;gap:6px;align-items:center;">
      <button class="btn btn-sm btn-secondary" data-action="arrows" title="Arrows/Lines" aria-label="Arrows/Lines">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 8 H12" stroke="currentColor" stroke-width="1.5"/>
        <path d="M9 5 L13 8 L9 11" fill="currentColor"/>
      </svg>
      <span style="margin-left:6px;">Arrows</span>
    </button>
    <select class="input-sm" data-select="arrow-type">
      <option value="arrow">-></option>
      <option value="dashed-arrow">- - -></option>
      <option value="line">________</option>
        <option value="dashed-line">- - -</option>
        <option value="double-arrow"><-></option>
        <option value="wavy-line">~</option>
        <option value="wavy-arrow">~></option>
      </select>
    </div>

    <button class="btn btn-sm btn-secondary" data-action="text" title="Add Text" aria-label="Add Text">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3 H13" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 3 V13" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span style="margin-left:6px;">Text</span>
    </button>
    <button class="btn btn-sm btn-secondary" data-action="brush" title="Freehand" aria-label="Freehand">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 11 C4 7, 6 13, 8 9 C10 5, 12 11, 14 7" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      <span style="margin-left:6px;">Freehand</span>
    </button>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;">
    <button class="btn btn-sm btn-secondary" data-action="remove">Remove Selected</button>
    <button class="btn btn-sm btn-secondary" data-action="undo">Undo</button>
    <button class="btn btn-sm btn-secondary" data-action="clear">Clear</button>
    <button class="btn btn-sm btn-primary" data-action="save">Save Diagram</button>
  </div>
</div>
`;
	}

	function setup_toolbar_actions(frm, canvas) {
		const toolbar = $(frm.fields_dict.canvas_html.wrapper).find(".diagram-toolbar");
		let mode = "select";
		let activeShape = null;
		let activeHead = null;
		let activeTail = null;
		let startPoint = null;
		const drawingModes = new Set([
			"arrow",
			"dashed-arrow",
			"line",
			"dashed-line",
			"double-arrow",
			"wavy-line",
			"wavy-arrow",
		]);

		const resetDrawingMode = () => {
			canvas.isDrawingMode = false;
			canvas.selection = true;
			canvas.forEachObject((obj) => {
				if (!obj.isBackground) {
					obj.selectable = true;
					obj.evented = true;
				}
			});
		};

		const clearActiveDrawing = () => {
			if (activeShape) {
				canvas.remove(activeShape);
			}
			if (activeHead) {
				canvas.remove(activeHead);
			}
			if (activeTail) {
				canvas.remove(activeTail);
			}
			activeShape = null;
			activeHead = null;
			activeTail = null;
			startPoint = null;
		};

		const setMode = (newMode) => {
			mode = newMode;
			clearActiveDrawing();
			resetDrawingMode();
			if (mode === "brush") {
				canvas.isDrawingMode = true;
				canvas.freeDrawingBrush.color = "#ffffff";
				canvas.freeDrawingBrush.width = 3;
			}
		};

		const addPlayer = (label, fill, stroke) => {
			const circle = new fabric.Circle({
				radius: 18,
				fill,
				stroke,
				strokeWidth: 2,
				name: "player-body",
			});
			const text = new fabric.Text(label, {
				fontSize: 12,
				fill: "#ffffff",
				fontWeight: "bold",
				originX: "center",
				originY: "center",
				name: "player-label",
			});
			const group = new fabric.Group([circle, text], {
				left: 80,
				top: 80,
				hasRotatingPoint: false,
				data: { shapeType: "player" },
			});
			canvas.add(group);
			canvas.setActiveObject(group);
		};

		const addBall = () => {
			const radius = 18;
			const base = new fabric.Circle({
				radius,
				fill: "#ffffff",
				stroke: "#111111",
				strokeWidth: 2,
				originX: "center",
				originY: "center",
				left: 0,
				top: 0,
			});

			const polygonPoints = (sides, r, rotationDeg = -90) => {
				const points = [];
				for (let i = 0; i < sides; i += 1) {
					const angle = ((rotationDeg + (360 / sides) * i) * Math.PI) / 180;
					points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
				}
				return points;
			};

			const centerPentagon = new fabric.Polygon(polygonPoints(5, radius * 0.45), {
				fill: "#111111",
				stroke: "#111111",
				strokeWidth: 1,
				originX: "center",
				originY: "center",
				left: 0,
				top: 0,
			});

			const patches = [];
			const ringDistance = radius * 0.78;
			for (let i = 0; i < 5; i += 1) {
				const angleDeg = -90 + i * 72;
				const angle = (angleDeg * Math.PI) / 180;
				const patch = new fabric.Polygon(polygonPoints(5, radius * 0.22, angleDeg), {
					fill: "#111111",
					stroke: "#111111",
					strokeWidth: 1,
					originX: "center",
					originY: "center",
					left: Math.cos(angle) * ringDistance,
					top: Math.sin(angle) * ringDistance,
				});
				patches.push(patch);
			}

			const group = new fabric.Group([base, centerPentagon, ...patches], {
				left: 80,
				top: 80,
				hasRotatingPoint: false,
			});
			canvas.add(group);
			canvas.setActiveObject(group);
		};

		const addCone = (fill) => {
			const triangle = new fabric.Triangle({
				width: 28,
				height: 30,
				fill,
				stroke: "#111111",
				strokeWidth: 2,
				left: 100,
				top: 100,
				data: { shapeType: "cone" },
			});
			canvas.add(triangle);
			canvas.setActiveObject(triangle);
		};

		const addMarker = (fill) => {
			const radius = 14;
			const base = new fabric.Circle({
				radius,
				fill,
				stroke: "#111111",
				strokeWidth: 2,
				originX: "center",
				originY: "center",
				left: 0,
				top: 0,
				name: "marker-body",
			});
			const dot = new fabric.Circle({
				radius: 4,
				fill: "#111111",
				originX: "center",
				originY: "center",
				left: 0,
				top: 0,
				name: "marker-dot",
			});
			const group = new fabric.Group([base, dot], {
				left: 100,
				top: 100,
				hasRotatingPoint: false,
				data: { shapeType: "marker" },
			});
			canvas.add(group);
			canvas.setActiveObject(group);
		};

		const addText = () => {
			const text = new fabric.Textbox("Text", {
				left: 120,
				top: 120,
				fontSize: 16,
				fill: "#ffffff",
				fontWeight: "bold",
				editable: true,
			});
			canvas.add(text);
			canvas.setActiveObject(text);
			canvas.requestRenderAll();
		};

		const pointerDiff = (evt) => {
			const { x, y } = canvas.getPointer(evt.e);
			return { x, y };
		};

		canvas.on("mouse:down", (evt) => {
			if (
				mode === "arrow" ||
				mode === "dashed-arrow" ||
				mode === "line" ||
				mode === "dashed-line" ||
				mode === "double-arrow" ||
				mode === "wavy-line" ||
				mode === "wavy-arrow"
			) {
				const { x, y } = pointerDiff(evt);
				startPoint = { x, y };

				if (mode === "wavy-line" || mode === "wavy-arrow") {
					activeShape = new fabric.Polyline([{ x, y }, { x, y }], {
						stroke: "#ffd60a",
						strokeWidth: 3,
						fill: "",
						strokeLineCap: "round",
						strokeLineJoin: "round",
					});
				} else {
					const isDashed = mode === "dashed-arrow" || mode === "dashed-line";
					activeShape = new fabric.Line([x, y, x, y], {
						stroke: "#ffd60a",
						strokeWidth: 3,
						strokeDashArray: isDashed ? [10, 6] : [],
					});
				}

				if (mode === "arrow" || mode === "dashed-arrow" || mode === "wavy-arrow") {
					activeHead = new fabric.Triangle({
						width: 14,
						height: 16,
						fill: "#ffd60a",
						originX: "center",
						originY: "center",
					});
				}

				if (mode === "double-arrow") {
					activeHead = new fabric.Triangle({
						width: 14,
						height: 16,
						fill: "#ffd60a",
						originX: "center",
						originY: "center",
					});
					activeTail = new fabric.Triangle({
						width: 14,
						height: 16,
						fill: "#ffd60a",
						originX: "center",
						originY: "center",
					});
				}

				canvas.add(activeShape);
				if (activeHead) {
					canvas.add(activeHead);
				}
				if (activeTail) {
					canvas.add(activeTail);
				}
			}
		});

		canvas.on("mouse:move", (evt) => {
			if (!activeShape || !startPoint) {
				return;
			}
			const { x, y } = pointerDiff(evt);

			if (activeShape.type === "polyline") {
				const points = buildWavyPoints(startPoint, { x, y });
				activeShape.set({ points });
			} else {
				activeShape.set({ x2: x, y2: y });
			}

			const angle =
				(Math.atan2(y - startPoint.y, x - startPoint.x) * 180) / Math.PI;

			if (activeHead) {
				activeHead.set({
					left: x,
					top: y,
					angle: angle + 90,
				});
			}
			if (activeTail) {
				activeTail.set({
					left: startPoint.x,
					top: startPoint.y,
					angle: angle - 90,
				});
			}

			canvas.requestRenderAll();
		});

		canvas.on("mouse:up", () => {
			if (activeShape) {
				const parts = [activeShape];
				if (activeHead) {
					parts.push(activeHead);
				}
				if (activeTail) {
					parts.push(activeTail);
				}
				if (parts.length > 1) {
					const group = new fabric.Group(parts, { hasRotatingPoint: false });
					canvas.remove(...parts);
					canvas.add(group);
					canvas.setActiveObject(group);
				}
				activeShape = null;
				activeHead = null;
				activeTail = null;
				startPoint = null;
				if (drawingModes.has(mode)) {
					setMode("select");
				}
			}
		});

		toolbar.on("click", "button[data-action]", async (e) => {
			const action = e.currentTarget.getAttribute("data-action");
			switch (action) {
				case "select":
					setMode("select");
					break;
				case "player": {
					const color = toolbar.find("[data-select='player-color']").val() || "#2563eb";
					addPlayer("P", color, "#111111");
					setMode("select");
					break;
				}
				case "add-ball":
					addBall();
					setMode("select");
					break;
				case "cone": {
					const color = toolbar.find("[data-select='cone-color']").val() || "#f97316";
					addCone(color);
					setMode("select");
					break;
				}
				case "marker": {
					const color = toolbar.find("[data-select='marker-color']").val() || "#facc15";
					addMarker(color);
					setMode("select");
					break;
				}
				case "text":
					addText();
					setMode("select");
					break;
				case "arrows": {
					const type = toolbar.find("[data-select='arrow-type']").val() || "arrow";
					setMode(type);
					break;
				}
				case "arrow":
					setMode("arrow");
					break;
				case "dashed-arrow":
					setMode("dashed-arrow");
					break;
				case "line":
					setMode("line");
					break;
				case "dashed-line":
					setMode("dashed-line");
					break;
				case "double-arrow":
					setMode("double-arrow");
					break;
				case "wavy-line":
					setMode("wavy-line");
					break;
				case "wavy-arrow":
					setMode("wavy-arrow");
					break;
				case "brush":
					setMode("brush");
					break;
				case "remove":
					removeSelected(canvas);
					break;
				case "undo":
					undo(canvas);
					break;
				case "clear":
					clearObjects(canvas);
					break;
				case "save":
					await saveDiagram(frm, canvas);
					break;
				default:
					break;
			}
		});

		toolbar.on("change", "select[data-select='arrow-type']", (e) => {
			const type = e.currentTarget.value;
			if (type) {
				setMode(type);
			}
		});

		toolbar.on("change", "select[data-select='player-color']", (e) => {
			applyColorToSelection(canvas, e.currentTarget.value, "player");
		});

		toolbar.on("change", "select[data-select='cone-color']", (e) => {
			applyColorToSelection(canvas, e.currentTarget.value, "cone");
		});

		toolbar.on("change", "select[data-select='marker-color']", (e) => {
			applyColorToSelection(canvas, e.currentTarget.value, "marker");
		});
	}

	function promptLabel(team) {
		const label = prompt(`Label for ${team} player?`, team === "Home" ? "H" : "A");
		return (label || "").trim().slice(0, 3).toUpperCase();
	}

	function buildWavyPoints(start, end) {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const length = Math.hypot(dx, dy);
		if (length < 2) {
			return [start, end];
		}

		const waves = Math.max(2, Math.round(length / 60));
		const amplitude = 6;
		const steps = Math.max(10, Math.round(length / 12));
		const ux = dx / length;
		const uy = dy / length;
		const px = -uy;
		const py = ux;

		const points = [];
		for (let i = 0; i <= steps; i += 1) {
			const t = i / steps;
			const baseX = start.x + dx * t;
			const baseY = start.y + dy * t;
			const offset = Math.sin(t * Math.PI * 2 * waves) * amplitude;
			points.push({
				x: baseX + px * offset,
				y: baseY + py * offset,
			});
		}
		return points;
	}

	function undo(canvas) {
		const objects = canvas.getObjects();
		for (let i = objects.length - 1; i >= 0; i -= 1) {
			if (!objects[i].isBackground) {
				canvas.remove(objects[i]);
				canvas.requestRenderAll();
				return;
			}
		}
	}

	function removeSelected(canvas) {
		const active = canvas.getActiveObject();
		if (!active || active.isBackground) {
			return;
		}
		if (active.type === "activeSelection") {
			active.forEachObject((obj) => {
				if (!obj.isBackground) {
					canvas.remove(obj);
				}
			});
			canvas.discardActiveObject();
		} else {
			canvas.remove(active);
		}
		canvas.requestRenderAll();
	}

	function applyColorToSelection(canvas, color, shapeType) {
		const active = canvas.getActiveObject();
		if (!active) {
			return;
		}

		const updateObject = (obj) => {
			if (!obj) {
				return;
			}
			if (shapeType === "player" && obj.type === "group" && obj.data?.shapeType === "player") {
				const body = obj._objects?.find((o) => o.name === "player-body");
				if (body) {
					body.set({ fill: color });
					obj.dirty = true;
				}
				return;
			}
			if (shapeType === "marker" && obj.type === "group" && obj.data?.shapeType === "marker") {
				const body = obj._objects?.find((o) => o.name === "marker-body");
				if (body) {
					body.set({ fill: color });
					obj.dirty = true;
				}
				return;
			}
			if (shapeType === "cone" && obj.data?.shapeType === "cone") {
				obj.set({ fill: color });
			}
		};

		if (active.type === "activeSelection") {
			active.forEachObject((obj) => updateObject(obj));
		} else {
			updateObject(active);
		}
		canvas.requestRenderAll();
	}

	function clearObjects(canvas) {
		const toRemove = canvas.getObjects().filter((obj) => !obj.isBackground);
		toRemove.forEach((obj) => canvas.remove(obj));
		canvas.requestRenderAll();
	}

	function restore_diagram_if_any(frm, canvas, width, height, previousSize, afterLoad) {
		if (!frm.doc.diagram_json) {
			return false;
		}
		try {
			const saved = JSON.parse(frm.doc.diagram_json);
			const cleaned = strip_background_objects(saved);
			if (!cleaned || !Array.isArray(cleaned.objects) || cleaned.objects.length === 0) {
				return false;
			}
			if (previousSize) {
				scale_objects_to_canvas(cleaned, previousSize, { w: width, h: height });
			}
			canvas.loadFromJSON(cleaned, () => {
				if (afterLoad) {
					afterLoad();
				}
				canvas.renderAll();
			});
			return true;
		} catch (err) {
			console.warn("Failed to load saved diagram", err);
			return false;
		}
	}

	function strip_background_objects(json) {
		if (!json || !Array.isArray(json.objects)) {
			return json;
		}
		return { ...json, objects: json.objects.filter((obj) => !obj.isBackground) };
	}

	function scale_objects_to_canvas(json, fromSize, toSize) {
		if (!json || !Array.isArray(json.objects) || !fromSize || !toSize) {
			return;
		}
		const scaleX = toSize.w / fromSize.w;
		const scaleY = toSize.h / fromSize.h;
		json.objects.forEach((obj) => {
			obj.scaleX = (obj.scaleX || 1) * scaleX;
			obj.scaleY = (obj.scaleY || 1) * scaleY;
			obj.left = (obj.left || 0) * scaleX;
			obj.top = (obj.top || 0) * scaleY;
			if (obj.type === "path" && obj.path) {
				obj.path = obj.path.map(([cmd, ...coords]) => {
					const scaled = coords.map((v, idx) => (idx % 2 === 0 ? v * scaleX : v * scaleY));
					return [cmd, ...scaled];
				});
			}
			if (obj.type === "polyline" && obj.points) {
				obj.points = obj.points.map(({ x, y }) => ({ x: x * scaleX, y: y * scaleY }));
			}
		});
	}

	async function saveDiagram(frm, canvas) {
		if (!canvas) {
			return;
		}

		const json = JSON.stringify(canvas.toJSON(["isBackground"]));
		frm.set_value("diagram_json", json);

		// Ensure doc exists before attaching file
		if (frm.is_new()) {
			await frm.save();
		}

		const dataUrl = canvas.toDataURL({
			format: "png",
			multiplier: 2,
		});

		try {
			const res = await frappe.call({
				method: "vulero_session_planner.api.diagram.save_diagram_file",
				args: {
					file_name: `diagram-${frm.doc.name || Math.floor(Math.random() * 1e6)}.png`,
					content: dataUrl.split(",")[1],
					docname: frm.doc.name,
					is_private: 0,
				},
			});
			if (res && res.message && res.message.file_url) {
				frm.set_value("preview_image", res.message.file_url);
			}
			await frm.save();
			frappe.show_alert({ message: __("Diagram saved"), indicator: "green" });
		} catch (err) {
			console.error(err);
			frappe.msgprint("Could not save diagram preview. Please try again.");
		}
	}
})();
