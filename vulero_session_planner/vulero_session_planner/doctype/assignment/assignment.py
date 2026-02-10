import frappe
from frappe.model.document import Document


def get_cohort_coaches(cohort):
	if not cohort:
		return []

	return frappe.get_all(
		"Coach Profile",
		filters={"cohort": cohort},
		fields=["name", "full_name"],
		order_by="full_name asc, name asc",
		limit=0,
	)


def sync_assignments_for_cohort(cohort):
	if not cohort:
		return

	assignment_names = frappe.get_all(
		"Assignment",
		filters={"cohort": cohort},
		fields=["name"],
		limit=0,
	)
	for assignment_row in assignment_names:
		assignment = frappe.get_doc("Assignment", assignment_row.name)
		assignment.save(ignore_permissions=True)


class Assignment(Document):
	def validate(self):
		self._validate_unique_active()
		self._sync_cohort_coaches()

	def _sync_cohort_coaches(self):
		self.set("cohort_coaches", [])
		if not self.cohort:
			return

		for coach in get_cohort_coaches(self.cohort):
			self.append(
				"cohort_coaches",
				{
					"coach": coach.name,
					"coach_name": coach.full_name or coach.name,
				},
			)

	def _validate_unique_active(self):
		if self.status != "Active":
			return

		filters = {
			"instructor": self.instructor,
			"cohort": self.cohort,
			"status": "Active",
		}
		if self.name:
			filters["name"] = ["!=", self.name]

		if frappe.db.exists("Assignment", filters):
			frappe.throw(
				"An active assignment already exists for this instructor and cohort.",
				title="Duplicate Assignment",
			)
