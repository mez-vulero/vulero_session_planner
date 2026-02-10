from frappe import _



def get_data():
	return {
		"fieldname": "license_program",
		"transactions": [
			{"label": _("Participants"), "items": ["Cohort", "Coach Profile"]},
			{"label": _("Content"), "items": ["Session Plan", "Rubric Template"]},
		],
	}
