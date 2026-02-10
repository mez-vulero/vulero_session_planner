app_name = "vulero_session_planner"
app_title = "Vulero Session Planner"
app_publisher = "vulerotech"
app_description = "Session planner to be used by Ethiopian Football Federation during CAF coach license training"
app_email = "mezmure.dawit@vulero.et"
app_license = "mit"

# Apps
# ------------------

# Fixtures
# ------------------

fixtures = [
	{
		"dt": "Role",
		"filters": [["name", "in", ["Coach Education Head", "Instructor", "Coach"]]],
	}
]

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "vulero_session_planner",
		"logo": "/assets/vulero_session_planner/logo.png",
		"title": "Vulero Session Planner",
		"route": "/app/vulero-session-planner",
		"has_permission": "vulero_session_planner.api.permission.has_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/vulero_session_planner/css/vulero_session_planner.css"
app_include_js = "/assets/vulero_session_planner/js/pwa.js"

# include js, css files in header of web template
# web_include_css = "/assets/vulero_session_planner/css/vulero_session_planner.css"
web_include_js = "/assets/vulero_session_planner/js/pwa.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "vulero_session_planner/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {"Diagram": "public/js/diagram.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "vulero_session_planner/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "vulero_session_planner.utils.jinja_methods",
# 	"filters": "vulero_session_planner.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "vulero_session_planner.install.before_install"
# after_install = "vulero_session_planner.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "vulero_session_planner.uninstall.before_uninstall"
# after_uninstall = "vulero_session_planner.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "vulero_session_planner.utils.before_app_install"
# after_app_install = "vulero_session_planner.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "vulero_session_planner.utils.before_app_uninstall"
# after_app_uninstall = "vulero_session_planner.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "vulero_session_planner.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"Session Plan": "vulero_session_planner.permissions.session_plan_permission_query_conditions",
	"Evaluation": "vulero_session_planner.permissions.evaluation_permission_query_conditions",
	"Review Comment": "vulero_session_planner.permissions.review_comment_permission_query_conditions",
	"Diagram": "vulero_session_planner.permissions.diagram_permission_query_conditions",
	"Coach Profile": "vulero_session_planner.permissions.coach_profile_permission_query_conditions",
	"Instructor Profile": "vulero_session_planner.permissions.instructor_profile_permission_query_conditions",
	"Assignment": "vulero_session_planner.permissions.assignment_permission_query_conditions",
	"Cohort": "vulero_session_planner.permissions.cohort_permission_query_conditions",
	"License Program": "vulero_session_planner.permissions.license_program_permission_query_conditions",
	"Rubric Template": "vulero_session_planner.permissions.rubric_template_permission_query_conditions",
	"File": "vulero_session_planner.permissions.file_permission_query_conditions",
}

has_permission = {
	"Session Plan": "vulero_session_planner.permissions.has_session_plan_permission",
	"Evaluation": "vulero_session_planner.permissions.has_evaluation_permission",
	"Review Comment": "vulero_session_planner.permissions.has_review_comment_permission",
	"Diagram": "vulero_session_planner.permissions.has_diagram_permission",
	"Coach Profile": "vulero_session_planner.permissions.has_coach_profile_permission",
	"Instructor Profile": "vulero_session_planner.permissions.has_instructor_profile_permission",
	"Assignment": "vulero_session_planner.permissions.has_assignment_permission",
	"Cohort": "vulero_session_planner.permissions.has_cohort_permission",
	"License Program": "vulero_session_planner.permissions.has_license_program_permission",
	"Rubric Template": "vulero_session_planner.permissions.has_rubric_template_permission",
	"File": "vulero_session_planner.permissions.has_file_permission",
}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"vulero_session_planner.tasks.daily",
	],
}

# Testing
# -------

# before_tests = "vulero_session_planner.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "vulero_session_planner.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "vulero_session_planner.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "vulero_session_planner.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["vulero_session_planner.utils.before_request"]
# after_request = ["vulero_session_planner.utils.after_request"]

# Job Events
# ----------
# before_job = ["vulero_session_planner.utils.before_job"]
# after_job = ["vulero_session_planner.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"vulero_session_planner.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
