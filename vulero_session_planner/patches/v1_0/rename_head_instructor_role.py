import frappe


def execute():
	rename_role()
	rename_doc_if_exists("Workspace", "Head Instructor", "Coach Education Head")
	rename_doc_if_exists("Workspace Sidebar", "Head Instructor", "Coach Education Head")


def rename_role():
	old = "Head Instructor"
	new = "Coach Education Head"
	if not frappe.db.exists("Role", old):
		return

	if frappe.db.exists("Role", new):
		replace_role_links(old, new)
		try:
			frappe.delete_doc("Role", old, force=True)
		except Exception:
			pass
		return

	rename_doc_if_exists("Role", old, new)
	replace_role_links(old, new)


def rename_doc_if_exists(doctype: str, old_name: str, new_name: str) -> None:
	if not frappe.db.exists(doctype, old_name):
		return
	try:
		frappe.rename_doc(doctype, old_name, new_name, force=True)
	except Exception:
		# Ignore if already renamed or if another patch handled it.
		pass


def replace_role_links(old: str, new: str) -> None:
	for table in ("tabHas Role", "tabRole Profile Role", "tabDocPerm", "tabCustom DocPerm"):
		try:
			frappe.db.sql(f"update `{table}` set role=%s where role=%s", (new, old))
		except Exception:
			pass
