import frappe
from frappe.utils import add_days, nowdate

from vulero_session_planner.utils import get_users_with_role, notify_users


def daily():
	update_expired_accounts()
	send_expiry_warnings()


def update_expired_accounts():
	today = nowdate()

	# Activate accounts that have been extended
	reactivate = frappe.get_all(
		"Coach Profile",
		filters={"account_expiry_date": [">=", today], "status": "Expired"},
		fields=["name"],
	)
	for row in reactivate:
		frappe.db.set_value("Coach Profile", row.name, "status", "Active")

	expired = frappe.get_all(
		"Coach Profile",
		filters={"account_expiry_date": ["<", today], "status": ["!=", "Expired"]},
		fields=["name", "user"],
	)
	for row in expired:
		frappe.db.set_value("Coach Profile", row.name, "status", "Expired")
		if row.user:
			notify_users(
				[row.user] + get_users_with_role("Coach Education Head"),
				subject="Coach account expired",
				document_type="Coach Profile",
				document_name=row.name,
			)


def send_expiry_warnings(days_before=7):
	target_date = add_days(nowdate(), days_before)
	warnings = frappe.get_all(
		"Coach Profile",
		filters={"account_expiry_date": target_date, "status": "Active"},
		fields=["name", "user"],
	)
	for row in warnings:
		recipients = [user for user in [row.user] if user]
		recipients += get_users_with_role("Coach Education Head")
		if recipients:
			notify_users(
				recipients,
				subject="Coach account expires in 7 days",
				document_type="Coach Profile",
				document_name=row.name,
			)
