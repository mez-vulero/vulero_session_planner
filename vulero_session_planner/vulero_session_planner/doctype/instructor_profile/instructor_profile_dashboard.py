from frappe import _



def get_data():
	return {
		"fieldname": "instructor",
		"transactions": [
			{"label": _("Activity"), "items": ["Assignment", "Evaluation", "Session Plan"]}
		],
		"non_standard_fieldnames": {"Session Plan": "current_instructor"},
	}
