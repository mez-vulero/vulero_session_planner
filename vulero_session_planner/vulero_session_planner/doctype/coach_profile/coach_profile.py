import frappe
from frappe.model.document import Document
from frappe.utils import add_days, nowdate

from vulero_session_planner.vulero_session_planner.doctype.assignment.assignment import (
	sync_assignments_for_cohort,
)


class CoachProfile(Document):
	def before_insert(self):
		if self.account_expiry_date or not self.license_program:
			return
		days = frappe.db.get_value("License Program", self.license_program, "default_expiry_days")
		if days:
			self.account_expiry_date = add_days(nowdate(), int(days))

	def validate(self):
		self._sync_status_with_expiry()

	def on_update(self):
		self._sync_assignments_for_cohorts()

	def on_trash(self):
		self._sync_assignments_for_cohorts()

	def _sync_status_with_expiry(self):
		if not self.account_expiry_date:
			return
		if self.account_expiry_date < nowdate():
			self.status = "Expired"
		elif self.status == "Expired":
			self.status = "Active"

	def _sync_assignments_for_cohorts(self):
		cohorts = set()
		if self.cohort:
			cohorts.add(self.cohort)

		previous = self.get_doc_before_save()
		if previous and previous.cohort and previous.cohort != self.cohort:
			cohorts.add(previous.cohort)

		for cohort in cohorts:
			sync_assignments_for_cohort(cohort)
