import frappe

from vulero_session_planner.utils import user_has_role


def has_app_permission(user=None):
	user = user or frappe.session.user
	if user in {"Administrator", "Guest"}:
		return user == "Administrator"

	allowed_roles = {"Head Instructor", "Instructor", "Coach", "System Manager"}
	return any(user_has_role(role, user) for role in allowed_roles)
