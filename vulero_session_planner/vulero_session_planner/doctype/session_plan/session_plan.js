frappe.ui.form.on("Session Plan", {
	refresh(frm) {
		set_target_group_options(frm);
		refresh_block_diagram_previews(frm);
		validate_duration_limit(frm);

		if (frm.is_new()) {
			return;
		}
		const canRevise =
			frm.doc.status === "Approved" &&
			(frappe.user.has_role("Coach") || frappe.user.has_role("Coach Education Head"));
		const canEvaluate =
			frm.doc.status === "Approved" && frappe.user.has_role("Instructor");

		if (canRevise) {
			frm.add_custom_button("Create Revision", () => {
				frappe.call({
					method:
						"vulero_session_planner.vulero_session_planner.doctype.session_plan.session_plan.create_revision",
					args: {
						session_plan_name: frm.doc.name,
					},
					callback: (r) => {
						if (r.message) {
							frappe.set_route("Form", "Session Plan", r.message);
						}
					},
				});
			});
		}

		if (canEvaluate) {
			frm.add_custom_button("Create Evaluation", () => {
				frappe.call({
					method:
						"vulero_session_planner.vulero_session_planner.doctype.session_plan.session_plan.get_evaluation_defaults",
					args: {
						session_plan_name: frm.doc.name,
					},
					callback: (r) => {
						if (!r.message) {
							return;
						}
						if (r.message.evaluation) {
							frappe.set_route("Form", "Evaluation", r.message.evaluation);
							return;
						}
						if (r.message.defaults) {
							frappe.new_doc("Evaluation", r.message.defaults);
						}
					},
				});
			});
		}
	},
	license_program(frm) {
		set_target_group_options(frm);
		validate_duration_limit(frm);
	},
	cohort(frm) {
		// Cohort changes can update license_program via server defaults
		set_target_group_options(frm);
		validate_duration_limit(frm);
	},
	duration_minutes(frm) {
		validate_duration_limit(frm);
	},
});

frappe.ui.form.on("Session Plan Block", {
	diagram(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row || !row.diagram) {
			frappe.model.set_value(cdt, cdn, "diagram_preview", "");
			return;
		}
		frappe.db.get_value("Diagram", row.diagram, "preview_image").then((r) => {
			const preview = r && r.message ? r.message.preview_image : "";
			frappe.model.set_value(cdt, cdn, "diagram_preview", preview || "");
		});
	},
});

function refresh_block_diagram_previews(frm) {
	const rows = frm.doc.blocks || [];
	rows.forEach((row) => {
		if (row.diagram && !row.diagram_preview) {
			frappe.db.get_value("Diagram", row.diagram, "preview_image").then((r) => {
				const preview = r && r.message ? r.message.preview_image : "";
				if (preview) {
					frappe.model.set_value(row.doctype, row.name, "diagram_preview", preview);
				}
			});
		}
	});
}

function set_target_group_options(frm) {
	const program = frm.doc.license_program;
	if (!program) {
		frm.set_df_property("target_group", "options", "");
		frm.set_value("target_group", "");
		return;
	}

	// License Program name is the docname; use it directly for matching
	apply_target_group_options(frm, program);

	// If it doesn't match, try the program_name field
	if (!is_known_program(program)) {
		frappe.db.get_value("License Program", program, "program_name").then((r) => {
			if (r && r.message && r.message.program_name) {
				apply_target_group_options(frm, r.message.program_name);
			}
		});
	}
}

function is_known_program(value) {
	const key = normalize_program(value);
	return (
		key === "CAF D" ||
		key === "CAF C" ||
		key === "CAF B" ||
		key === "CAF A" ||
		key === "CAF PRO"
	);
}

function normalize_program(value) {
	return (value || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function apply_target_group_options(frm, programValue) {
	const key = normalize_program(programValue);
	let options = [];

	if (key === "CAF D") {
		options = ["U12", "U9"];
	} else if (key === "CAF C") {
		options = ["U17", "U14"];
	} else if (key === "CAF B") {
		options = ["Second Division Club", "U20", "U17"];
	} else if (key === "CAF A" || key === "CAF PRO") {
		options = ["Senior Team"];
	}

	frm.set_df_property("target_group", "options", options.join("\n"));
	if (options.length && !options.includes(frm.doc.target_group)) {
		frm.set_value("target_group", "");
	}
	frm.refresh_field("target_group");
}

function get_duration_limit(programValue) {
	const key = normalize_program(programValue);
	if (key === "CAF D") {
		return 60;
	}
	if (key === "CAF C" || key === "CAF B" || key === "CAF A" || key === "CAF PRO") {
		return 90;
	}
	return null;
}

function validate_duration_limit(frm) {
	const duration = frm.doc.duration_minutes;
	if (!duration) {
		return;
	}
	const program = frm.doc.license_program;
	if (!program) {
		return;
	}

	let limit = get_duration_limit(program);
	if (!limit && !is_known_program(program)) {
		frappe.db.get_value("License Program", program, "program_name").then((r) => {
			if (r && r.message && r.message.program_name) {
				const resolvedLimit = get_duration_limit(r.message.program_name);
				if (resolvedLimit && duration > resolvedLimit) {
					frappe.msgprint(
						`Duration cannot exceed ${resolvedLimit} minutes for ${r.message.program_name}.`
					);
				}
			}
		});
		return;
	}

	if (limit && duration > limit) {
		frappe.msgprint(`Duration cannot exceed ${limit} minutes for ${program}.`);
	}
}
