from frappe import _



def get_data():
	return {
		"fieldname": "diagram",
		"transactions": [
			{"label": _("Feedback"), "items": ["Review Comment"]},
			{"label": _("References"), "items": ["Session Plan"]},
		],
		"internal_links": {
			"Session Plan": "linked_session_plan",
		},
	}
