import frappe
from frappe.model.document import Document
from frappe.utils import flt

from vulero_session_planner.utils import (
	ensure_user_not_expired,
	get_users_with_role,
	notify_users,
	user_has_role,
)


class Evaluation(Document):
	def validate(self):
		ensure_user_not_expired()
		self._set_defaults_from_session_plan()
		self._ensure_session_plan_approved()
		self._ensure_editable()
		self._validate_scores()
		self._set_total_score()

	def on_update(self):
		if self._status_changed_to("Published"):
			self._notify_published()

	def _set_defaults_from_session_plan(self):
		if not self.session_plan:
			return
		session_plan = frappe.get_doc("Session Plan", self.session_plan)
		if not self.coach:
			self.coach = session_plan.coach
		if not self.cohort:
			self.cohort = session_plan.cohort
		if not self.license_program:
			self.license_program = session_plan.license_program
		if not self.instructor and session_plan.current_instructor:
			self.instructor = session_plan.current_instructor

	def _ensure_session_plan_approved(self):
		if not self.session_plan:
			return
		status = frappe.db.get_value("Session Plan", self.session_plan, "status")
		if status != "Approved":
			frappe.throw("Evaluations can only be created for approved session plans.")

	def _ensure_editable(self):
		previous = self._get_previous_status()
		if previous == "Published" and not user_has_role("Coach Education Head"):
			frappe.throw("Published evaluations are read-only.")

	def _validate_scores(self):
		for row in self.scores or []:
			max_score = flt(row.max_score) if row.max_score is not None else 0
			score = flt(row.score)
			if score < 0:
				frappe.throw("Scores cannot be negative.")
			if max_score and score > max_score:
				frappe.throw(
					f"Score {score} exceeds max {max_score} for {row.criterion_title}."
				)

	def _set_total_score(self):
		total = 0.0
		for row in self.scores or []:
			weight = flt(row.weight) if row.weight is not None else 1.0
			total += flt(row.score) * weight
		self.total_score = total

	def _notify_published(self):
		coach_user = frappe.db.get_value("Coach Profile", self.coach, "user")
		recipients = set(get_users_with_role("Coach Education Head"))
		if coach_user:
			recipients.add(coach_user)
		if recipients:
			notify_users(
				list(recipients),
				subject=f"Evaluation Published for {self.session_plan}",
				document_type="Evaluation",
				document_name=self.name,
			)

	def _get_previous_status(self):
		previous = self.get_doc_before_save()
		return previous.status if previous else None

	def _status_changed_to(self, status):
		previous = self._get_previous_status()
		return previous != status and self.status == status

	def on_trash(self):
		if self.status == "Published" and not user_has_role("Coach Education Head"):
			frappe.throw("Published evaluations cannot be deleted.")
