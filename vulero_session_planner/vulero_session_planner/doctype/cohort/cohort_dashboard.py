from frappe import _



def get_data():
	return {
		"fieldname": "cohort",
		"transactions": [
			{"label": _("Activity"), "items": ["Session Plan", "Assignment", "Coach Profile"]},
			{"label": _("References"), "items": ["License Program"]},
		],
		"internal_links": {
			"License Program": "license_program",
		},
	}
