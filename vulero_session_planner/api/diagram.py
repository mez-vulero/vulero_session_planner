import frappe
from frappe.utils.file_manager import save_file


@frappe.whitelist()
def save_diagram_file(file_name: str, content: str, docname: str, is_private: int = 0):
	"""
	Save a base64-encoded PNG for a Diagram doc and return the file URL.
	"""
	if not docname:
		frappe.throw("Diagram must be saved before uploading a preview.")

	file_doc = save_file(file_name, content, "Diagram", docname, is_private=is_private, decode=True)
	return {"file_url": file_doc.file_url}
