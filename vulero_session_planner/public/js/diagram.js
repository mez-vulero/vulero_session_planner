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

		const addLine = (x1, y1, x2, y2) => {
			const line = new fabric.Line([x1, y1, x2, y2], {
				stroke: "#ffffff",
				strokeWidth: 2,
				selectable: false,
				evented: false,
				isBackground: true,
			});
			canvas.add(line);
			canvas.sendToBack(line);
		};

		const addRect = (x, y, w, h) => {
			const rect = new fabric.Rect({
				left: x,
				top: y,
				width: w,
				height: h,
				fill: "",
				stroke: "#ffffff",
				strokeWidth: 2,
				selectable: false,
				evented: false,
				isBackground: true,
			});
			canvas.add(rect);
			canvas.sendToBack(rect);
		};

		const addCircle = (cx, cy, r) => {
			const circle = new fabric.Circle({
				left: cx - r,
				top: cy - r,
				radius: r,
				fill: "",
				stroke: "#ffffff",
				strokeWidth: 2,
				selectable: false,
				evented: false,
				isBackground: true,
			});
			canvas.add(circle);
			canvas.sendToBack(circle);
		};

		const addSpot = (cx, cy, r = 3) => {
			const spot = new fabric.Circle({
				left: cx - r,
				top: cy - r,
				radius: r,
				fill: "#ffffff",
				stroke: "#ffffff",
				strokeWidth: 1,
				selectable: false,
				evented: false,
				isBackground: true,
			});
			canvas.add(spot);
			canvas.sendToBack(spot);
		};

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

		const addArc = (cx, cy, r, startAngle, endAngle) => {
			const arc = new fabric.Circle({
				left: cx - r,
				top: cy - r,
				radius: r,
				startAngle,
				endAngle,
				fill: "",
				stroke: "#ffffff",
				strokeWidth: 2,
				selectable: false,
				evented: false,
				isBackground: true,
			});
			canvas.add(arc);
			canvas.sendToBack(arc);
		};

		if (pitchType === "Full" || pitchType === "Custom") {
			// Mid line and center circle
			const midStart = mapPoint(fieldLength / 2, 0);
			const midEnd = mapPoint(fieldLength / 2, fieldBreadth);
			addLine(midStart.x, midStart.y, midEnd.x, midEnd.y);

			const center = mapPoint(fieldLength / 2, fieldBreadth / 2);
			addCircle(center.x, center.y, centerCircleRadius);

			drawPenaltyArea(0, 1);
			drawPenaltyArea(fieldLength, -1);
		} else if (pitchType === "Half") {
			drawPenaltyArea(0, 1);
			const center = mapPoint(fieldLength, fieldBreadth / 2);
			const start = isVertical ? 0 : Math.PI / 2;
			const end = isVertical ? Math.PI : Math.PI * 1.5;
			addArc(center.x, center.y, centerCircleRadius, start, end);
		} else if (pitchType === "Third") {
			drawPenaltyArea(0, 1);
		}
	}

	function build_toolbar_html() {
		return `
<div class="diagram-toolbar" style="display:flex;gap:8px;flex-wrap:wrap;">
  <button class="btn btn-sm btn-secondary" data-action="select">Select/Move</button>
  <button class="btn btn-sm btn-secondary" data-action="add-home">Add Home</button>
  <button class="btn btn-sm btn-secondary" data-action="add-away">Add Away</button>
  <button class="btn btn-sm btn-secondary" data-action="add-ball">Add Ball</button>
  <button class="btn btn-sm btn-secondary" data-action="add-cone">Add Cone</button>
  <button class="btn btn-sm btn-secondary" data-action="arrow">Arrow</button>
  <button class="btn btn-sm btn-secondary" data-action="dashed-arrow">Dashed Arrow</button>
  <button class="btn btn-sm btn-secondary" data-action="line">Line</button>
  <button class="btn btn-sm btn-secondary" data-action="dashed-line">Dashed Line</button>
  <button class="btn btn-sm btn-secondary" data-action="double-arrow">Double Arrow</button>
  <button class="btn btn-sm btn-secondary" data-action="wavy-line">Wavy Line</button>
  <button class="btn btn-sm btn-secondary" data-action="wavy-arrow">Wavy Arrow</button>
  <button class="btn btn-sm btn-secondary" data-action="brush">Freehand</button>
  <button class="btn btn-sm btn-secondary" data-action="remove">Remove Selected</button>
  <button class="btn btn-sm btn-secondary" data-action="undo">Undo</button>
  <button class="btn btn-sm btn-secondary" data-action="clear">Clear</button>
  <button class="btn btn-sm btn-primary" data-action="save">Save Diagram</button>
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

		const setMode = (newMode) => {
			mode = newMode;
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
			});
			const text = new fabric.Text(label, {
				fontSize: 12,
				fill: "#ffffff",
				fontWeight: "bold",
				originX: "center",
				originY: "center",
			});
			const group = new fabric.Group([circle, text], {
				left: 80,
				top: 80,
				hasRotatingPoint: false,
			});
			canvas.add(group);
			canvas.setActiveObject(group);
		};

		const addCone = () => {
			const triangle = new fabric.Triangle({
				width: 28,
				height: 30,
				fill: "#f97316",
				stroke: "#ea580c",
				strokeWidth: 2,
				left: 100,
				top: 100,
			});
			canvas.add(triangle);
			canvas.setActiveObject(triangle);
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
					activeShape = new fabric.Line([x, y, x, y], {
						stroke: "#ffd60a",
						strokeWidth: 3,
						strokeDashArray: mode === "dashed-arrow" || mode === "dashed-line" ? [10, 6] : null,
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
			}
		});

		toolbar.on("click", "button[data-action]", async (e) => {
			const action = e.currentTarget.getAttribute("data-action");
			switch (action) {
				case "select":
					setMode("select");
					break;
				case "add-home":
					addPlayer(promptLabel("Home") || "H", "#2563eb", "#1d4ed8");
					break;
				case "add-away":
					addPlayer(promptLabel("Away") || "A", "#dc2626", "#b91c1c");
					break;
				case "add-ball":
					addPlayer("●", "#fbbf24", "#f59e0b");
					break;
				case "add-cone":
					addCone();
					break;
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
