import frappe
from frappe.utils import nowdate


def get_coach_profile_for_user(user):
	return frappe.db.get_value("Coach Profile", {"user": user}, "name")


def get_instructor_profile_for_user(user):
	return frappe.db.get_value("Instructor Profile", {"user": user}, "name")


def get_users_with_role(role):
	rows = frappe.get_all(
		"Has Role",
		filters={"role": role, "parenttype": "User"},
		fields=["parent"],
	)
	return [row.parent for row in rows]


def user_has_role(role, user=None):
	user = user or frappe.session.user
	return role in frappe.get_roles(user)


def get_instructor_users_for_coach(coach, cohort=None):
	if not coach and not cohort:
		return []

	cohort_name = cohort
	if not cohort_name and coach:
		cohort_name = frappe.db.get_value("Coach Profile", coach, "cohort")

	if not cohort_name:
		return []

	filters = {"cohort": cohort_name, "status": "Active"}

	assignments = frappe.get_all(
		"Assignment",
		filters=filters,
		fields=["instructor"],
		limit=0,
	)

	instructor_names = [row.instructor for row in assignments if row.instructor]

	if not instructor_names:
		return []

	instructors = frappe.get_all(
		"Instructor Profile",
		filters={"name": ["in", instructor_names]},
		fields=["user"],
	)
	return [row.user for row in instructors if row.user]


def get_assigned_cohorts_for_instructor(instructor):
	if not instructor:
		return []

	assignments = frappe.get_all(
		"Assignment",
		filters={"instructor": instructor, "status": "Active"},
		fields=["cohort"],
		limit=0,
	)
	cohorts = [row.cohort for row in assignments if row.cohort]
	return list(dict.fromkeys(cohorts))


def get_assigned_coaches_for_instructor(instructor):
	cohorts = get_assigned_cohorts_for_instructor(instructor)
	if not cohorts:
		return []

	coaches = frappe.get_all(
		"Coach Profile",
		filters={"cohort": ["in", cohorts]},
		fields=["name"],
		limit=0,
	)
	return [row.name for row in coaches if row.name]


def notify_users(users, subject, document_type=None, document_name=None):
	for user in set(users or []):
		if not user:
			continue
		if not frappe.db.exists("User", user):
			continue
		frappe.get_doc(
			{
				"doctype": "Notification Log",
				"subject": subject,
				"for_user": user,
				"type": "Alert",
				"document_type": document_type,
				"document_name": document_name,
			}
		).insert(ignore_permissions=True)


def ensure_user_not_expired(user=None):
	user = user or frappe.session.user
	if user == "Administrator" or user_has_role("Head Instructor", user):
		return

	coach = frappe.db.get_value(
		"Coach Profile", {"user": user}, ["status", "account_expiry_date"], as_dict=True
	)
	if not coach:
		return

	if coach.status in {"Expired", "Suspended"}:
		frappe.throw("Your account is expired or suspended. Contact the Head Instructor.")

	if coach.account_expiry_date and coach.account_expiry_date < nowdate():
		frappe.throw("Your account has expired. Contact the Head Instructor.")
