from frappe import _



def get_data():
		return {
			"fieldname": "session_plan",
			"transactions": [
				{"label": _("Reviews"), "items": ["Evaluation", "Review Comment"]},
				{"label": _("Visuals"), "items": ["Diagram"]},
			],
			"non_standard_fieldnames": {"Diagram": "linked_session_plan"},
			"internal_links": {},
		}
