frappe.ui.form.on("Session Plan", {
	refresh(frm) {
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
});
