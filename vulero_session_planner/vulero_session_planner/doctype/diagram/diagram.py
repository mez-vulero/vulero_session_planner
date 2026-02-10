import frappe
from frappe.model.document import Document

from vulero_session_planner.utils import ensure_user_not_expired


class Diagram(Document):
	def validate(self):
		ensure_user_not_expired()
		self._sync_linked_block()

	def before_insert(self):
		if not self.created_by:
			self.created_by = frappe.session.user

	def _sync_linked_block(self):
		if not self.linked_session_plan or not self.linked_block_sequence:
			return

		sequence = int(self.linked_block_sequence)
		filters = {
			"parent": self.linked_session_plan,
			"parenttype": "Session Plan",
			"parentfield": "blocks",
		}
		block_name = frappe.db.get_value("Session Plan Block", {**filters, "sequence": sequence}, "name")
		if not block_name:
			block_name = frappe.db.get_value("Session Plan Block", {**filters, "idx": sequence}, "name")
		if not block_name:
			return

		frappe.db.set_value("Session Plan Block", block_name, "diagram", self.name, update_modified=False)
