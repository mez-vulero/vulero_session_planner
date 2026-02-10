from frappe import _



def get_data():
	return {
		"transactions": [
			{"label": _("References"), "items": ["Session Plan", "Diagram"]}
		],
		"internal_links": {
			"Session Plan": "session_plan",
			"Diagram": "diagram",
		},
	}
