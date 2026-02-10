from frappe import _



def get_data():
	return {
		"transactions": [
			{"label": _("References"), "items": ["Session Plan", "Coach Profile", "Instructor Profile", "Cohort", "License Program"]}
		],
		"internal_links": {
			"Session Plan": "session_plan",
			"Coach Profile": "coach",
			"Instructor Profile": "instructor",
			"Cohort": "cohort",
			"License Program": "license_program",
		},
	}
