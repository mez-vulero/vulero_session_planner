from frappe import _



def get_data():
	return {
		"transactions": [
			{"label": _("References"), "items": ["Instructor Profile", "Cohort"]}
		],
		"internal_links": {
			"Instructor Profile": "instructor",
			"Cohort": "cohort",
		},
	}
