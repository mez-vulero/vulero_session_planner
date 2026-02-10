from frappe import _



def get_data():
	return {
		"transactions": [
			{"label": _("References"), "items": ["License Program"]}
		],
		"internal_links": {
			"License Program": "license_program",
		},
	}
