import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

from vulero_session_planner.utils import user_has_role


class ReviewComment(Document):
	def before_insert(self):
		if not self.created_by:
			self.created_by = frappe.session.user
		if not self.created_on:
			self.created_on = now_datetime()

	def validate(self):
		if self.is_new():
			return
		if not user_has_role("Coach Education Head"):
			frappe.throw("Review comments are immutable.", title="Not Permitted")

	def on_trash(self):
		if not user_has_role("Coach Education Head"):
			frappe.throw("Only Coach Education Head can delete review comments.")
