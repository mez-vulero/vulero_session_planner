from frappe import _



def get_data():
	return {
		"fieldname": "coach",
		"transactions": [
			{"label": _("Activity"), "items": ["Session Plan", "Evaluation"]},
			{"label": _("References"), "items": ["Cohort", "License Program"]},
		],
		"internal_links": {
			"Cohort": "cohort",
			"License Program": "license_program",
		},
	}
