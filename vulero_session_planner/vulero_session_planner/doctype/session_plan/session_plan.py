import frappe
from frappe.model.document import Document
from frappe.utils import flt

from vulero_session_planner.utils import (
	ensure_user_not_expired,
	get_coach_profile_for_user,
	get_instructor_profile_for_user,
	get_instructor_users_for_coach,
	get_users_with_role,
	notify_users,
	user_has_role,
)


class SessionPlan(Document):
	def validate(self):
		ensure_user_not_expired()
		self._set_defaults_from_coach()
		self._ensure_editable_for_state()
		self._ensure_blocks_for_state()
		self._validate_duration_limit()
		self._validate_time_totals()
		self._set_current_instructor_on_submit()
		self._apply_approval_lock()

	def on_update(self):
		self._log_status_change()
		if self._status_changed_to("Submitted"):
			self._notify_submitted()
		elif self._status_changed_to("Changes Requested"):
			self._notify_changes_requested()
		elif self._status_changed_to("Approved"):
			self._generate_pdf_export()
			self._notify_approved()
		self._sync_diagram_links()

	def _set_defaults_from_coach(self):
		if not self.coach:
			return
		if not self.license_program or not self.cohort:
			coach = frappe.get_doc("Coach Profile", self.coach)
			if not self.license_program and coach.license_program:
				self.license_program = coach.license_program
			if not self.cohort and coach.cohort:
				self.cohort = coach.cohort

	def _ensure_editable_for_state(self):
		previous = self._get_previous_status()
		if self.locked and not self._allow_locked_transition(previous):
			frappe.throw(
				"This session plan is locked. Create a revision to make changes.",
				title="Locked Session Plan",
			)

		is_coach = user_has_role("Coach")
		if previous == "Submitted" and self.status == "Submitted" and is_coach:
			frappe.throw("Submitted session plans are read-only for coaches.")

		if previous == "Approved" and self.status == "Approved" and not user_has_role("Coach Education Head"):
			frappe.throw("Approved session plans are read-only.")

		if self.status == "Archived" and not user_has_role("Coach Education Head"):
			frappe.throw("Only Coach Education Head can archive session plans.")

	def _allow_locked_transition(self, previous):
		if user_has_role("Coach Education Head") and self.status == "Archived":
			return True
		if previous != self.status and self.status == "Archived":
			return True
		return False

	def _ensure_blocks_for_state(self):
		if self.status in {"Submitted", "Approved"} and not self.blocks:
			frappe.throw("Session Plan must have at least one block before submission.")

	def _validate_time_totals(self):
		if not self.duration_minutes or not self.blocks:
			return

		block_total = 0
		for block in self.blocks:
			if block.time_minutes:
				block_total += flt(block.time_minutes)

		if not block_total:
			return

		threshold = flt(self.duration_minutes) * 0.2
		if abs(block_total - flt(self.duration_minutes)) > threshold:
			frappe.msgprint(
				"Total block time differs from session duration by more than 20%.",
				alert=True,
				indicator="orange",
			)

	def _normalize_program(self, value):
		return (value or "").upper().strip().replace("  ", " ")

	def _get_duration_limit(self):
		if not self.license_program:
			return None, None

		def resolve_limit(program_name):
			key = self._normalize_program(program_name)
			if key == "CAF D":
				return 60
			if key in {"CAF C", "CAF B", "CAF A", "CAF PRO"}:
				return 90
			return None

		limit = resolve_limit(self.license_program)
		if limit:
			return limit, self.license_program

		program_name = frappe.db.get_value("License Program", self.license_program, "program_name")
		if program_name:
			limit = resolve_limit(program_name)
			if limit:
				return limit, program_name

		return None, None

	def _validate_duration_limit(self):
		if not self.duration_minutes:
			return
		limit, program_name = self._get_duration_limit()
		if limit and self.duration_minutes > limit:
			label = program_name or self.license_program or "the selected program"
			frappe.throw(f"Duration cannot exceed {limit} minutes for {label}.")

	def _set_current_instructor_on_submit(self):
		if self.current_instructor:
			return
		if not self._status_changed_to("Submitted"):
			return

		cohort = self.cohort
		if not cohort and self.coach:
			cohort = frappe.db.get_value("Coach Profile", self.coach, "cohort")

		if not cohort:
			return

		assignment = frappe.get_all(
			"Assignment",
			filters={"cohort": cohort, "status": "Active"},
			fields=["instructor"],
			order_by="start_date desc, modified desc",
			limit=1,
		)

		if assignment:
			self.current_instructor = assignment[0].instructor

	def _apply_approval_lock(self):
		if not self._status_changed_to("Approved"):
			return

		self.locked = 1
		self.approved_version = self.version_no or 1

	def _notify_submitted(self):
		coach_user = self._get_coach_user()
		instructor_users = get_instructor_users_for_coach(self.coach, self.cohort)
		recipients = set(instructor_users + get_users_with_role("Coach Education Head"))
		if coach_user:
			recipients.discard(coach_user)
		if recipients:
			notify_users(
				list(recipients),
				subject=f"Session Plan Submitted: {self.title}",
				document_type="Session Plan",
				document_name=self.name,
			)

	def _notify_changes_requested(self):
		coach_user = self._get_coach_user()
		if coach_user:
			notify_users(
				[coach_user],
				subject=f"Changes Requested: {self.title}",
				document_type="Session Plan",
				document_name=self.name,
			)

	def _notify_approved(self):
		recipients = set(get_users_with_role("Coach Education Head"))
		coach_user = self._get_coach_user()
		if coach_user:
			recipients.add(coach_user)
		if recipients:
			notify_users(
				list(recipients),
				subject=f"Session Plan Approved: {self.title}",
				document_type="Session Plan",
				document_name=self.name,
			)

	def _generate_pdf_export(self):
		try:
			pdf_content = frappe.get_print("Session Plan", self.name, as_pdf=True)
			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"{self.name}.pdf",
					"content": pdf_content,
					"is_private": 1,
					"attached_to_doctype": "Session Plan",
					"attached_to_name": self.name,
				}
			)
			file_doc.save(ignore_permissions=True)
			frappe.db.set_value("Session Plan", self.name, "pdf_export", file_doc.file_url)
		except Exception:
			frappe.log_error(title="Session Plan PDF Export Failed")

	def _sync_diagram_links(self):
		for block in self.blocks or []:
			if not block.diagram:
				continue
			frappe.db.set_value(
				"Diagram",
				block.diagram,
				{
					"linked_session_plan": self.name,
					"linked_block_sequence": block.sequence or block.idx,
				},
				update_modified=False,
			)

	def _log_status_change(self):
		previous = self._get_previous_status()
		if not previous or previous == self.status:
			return

		frappe.get_doc(
			{
				"doctype": "Comment",
				"comment_type": "Workflow",
				"reference_doctype": "Session Plan",
				"reference_name": self.name,
				"content": f"Status changed from {previous} to {self.status} by {frappe.session.user}.",
			}
		).insert(ignore_permissions=True)

	def _get_previous_status(self):
		previous = self.get_doc_before_save()
		return previous.status if previous else None

	def _status_changed_to(self, status):
		previous = self._get_previous_status()
		return previous != status and self.status == status

	def _get_coach_user(self):
		if not self.coach:
			return None
		return frappe.db.get_value("Coach Profile", self.coach, "user")


@frappe.whitelist()
def create_revision(session_plan_name):
	plan = frappe.get_doc("Session Plan", session_plan_name)
	if plan.status != "Approved":
		frappe.throw("Only approved session plans can be revised.")

	if not (user_has_role("Coach Education Head") or _is_current_user_coach(plan.coach)):
		frappe.throw("Not permitted to create a revision for this session plan.")

	new_plan = frappe.copy_doc(plan)
	new_plan.name = None
	new_plan.status = "Draft"
	new_plan.locked = 0
	new_plan.pdf_export = None
	new_plan.revised_from = plan.name
	new_plan.version_no = (plan.version_no or 1) + 1
	new_plan.approved_version = plan.approved_version
	new_plan.insert(ignore_permissions=True)

	return new_plan.name


@frappe.whitelist()
def get_evaluation_defaults(session_plan_name):
	plan = frappe.get_doc("Session Plan", session_plan_name)

	if plan.status != "Approved":
		frappe.throw("Evaluations can only be created for approved session plans.")

	user = frappe.session.user
	if not user_has_role("Instructor", user):
		frappe.throw("Only instructors can create evaluations.")

	instructor = get_instructor_profile_for_user(user)
	if not instructor:
		frappe.throw("No Instructor Profile linked to your user.")

	cohort = plan.cohort
	if not cohort and plan.coach:
		cohort = frappe.db.get_value("Coach Profile", plan.coach, "cohort")
	if not cohort or not frappe.db.exists(
		"Assignment",
		{"cohort": cohort, "instructor": instructor, "status": "Active"},
	):
		frappe.throw("You are not assigned to this cohort.")

	existing = frappe.db.get_value(
		"Evaluation",
		{"session_plan": plan.name, "instructor": instructor},
		"name",
	)
	if existing:
		return {"evaluation": existing}

	defaults = {"session_plan": plan.name, "instructor": instructor}
	if plan.coach:
		defaults["coach"] = plan.coach
	if plan.cohort:
		defaults["cohort"] = plan.cohort
	if plan.license_program:
		defaults["license_program"] = plan.license_program
	if plan.session_date:
		defaults["session_date"] = plan.session_date

	return {"defaults": defaults}


def _is_current_user_coach(coach_profile):
	if not coach_profile:
		return False
	user = frappe.session.user
	return get_coach_profile_for_user(user) == coach_profile
