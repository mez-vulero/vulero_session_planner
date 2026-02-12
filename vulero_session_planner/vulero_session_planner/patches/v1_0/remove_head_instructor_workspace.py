import frappe


def execute():
	remove_workspace_if_exists("Head Instructor")
	remove_workspace_if_exists("Workspace Sidebar", "Head Instructor")
	remove_role_if_exists("Head Instructor", "Coach Education Head")


def remove_workspace_if_exists(doctype: str, name: str | None = None) -> None:
	target = name or doctype
	if not frappe.db.exists(doctype, target):
		return
	try:
		frappe.delete_doc(doctype, target, force=True, ignore_missing=True)
	except Exception:
		pass


def remove_role_if_exists(old: str, new: str) -> None:
	if not frappe.db.exists("Role", old):
		return
	try:
		if frappe.db.exists("Role", new):
			replace_role_links(old, new)
		frappe.delete_doc("Role", old, force=True, ignore_missing=True)
	except Exception:
		pass


def replace_role_links(old: str, new: str) -> None:
	for table in ("tabHas Role", "tabRole Profile Role", "tabDocPerm", "tabCustom DocPerm"):
		try:
			frappe.db.sql(f"update `{table}` set role=%s where role=%s", (new, old))
		except Exception:
			pass
