import frappe

from vulero_session_planner.utils import (
	get_assigned_cohorts_for_instructor,
	get_coach_profile_for_user,
	get_instructor_profile_for_user,
	user_has_role,
)


def _has_full_access(user):
	return user in {"Administrator"} or user_has_role("Coach Education Head", user) or user_has_role(
		"System Manager", user
	)


def _get_active_assignment_cohort_subquery(instructor):
	return (
		"select cohort from `tabAssignment` where instructor = {instructor} and status = 'Active'"
		" and ifnull(cohort, '') != ''"
	).format(instructor=frappe.db.escape(instructor))


def _get_assigned_coach_subquery(instructor):
	cohort_subquery = _get_active_assignment_cohort_subquery(instructor)
	return (
		"select name from `tabCoach Profile` where cohort in ({cohorts})"
		" and ifnull(cohort, '') != ''"
	).format(cohorts=cohort_subquery)


def _instructor_has_cohort_assignment(instructor, cohort):
	if not instructor or not cohort:
		return False
	return bool(
		frappe.db.exists(
			"Assignment",
			{"cohort": cohort, "instructor": instructor, "status": "Active"},
		)
	)


def session_plan_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"`tabSession Plan`.`cohort` in ({cohorts})"
			" or `tabSession Plan`.`coach` in ({coaches})"
		).format(
			cohorts=_get_active_assignment_cohort_subquery(instructor),
			coaches=_get_assigned_coach_subquery(instructor),
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return "`tabSession Plan`.`coach` = {coach}".format(coach=frappe.db.escape(coach))

	return "1=0"


def evaluation_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"`tabEvaluation`.`cohort` in ({cohorts})"
			" or `tabEvaluation`.`coach` in ({coaches})"
		).format(
			cohorts=_get_active_assignment_cohort_subquery(instructor),
			coaches=_get_assigned_coach_subquery(instructor),
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return "`tabEvaluation`.`coach` = {coach}".format(coach=frappe.db.escape(coach))

	return "1=0"


def review_comment_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"`tabReview Comment`.`session_plan` in ("
			"select name from `tabSession Plan` where cohort in ({cohorts})"
			" or coach in ({coaches})"
			")"
		).format(
			cohorts=_get_active_assignment_cohort_subquery(instructor),
			coaches=_get_assigned_coach_subquery(instructor),
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			"`tabReview Comment`.`session_plan` in ("
			"select name from `tabSession Plan` where coach = {coach}"
			")"
		).format(coach=frappe.db.escape(coach))

	return "1=0"


def diagram_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"(`tabDiagram`.`linked_session_plan` in ("
			"select name from `tabSession Plan` where cohort in ({cohorts})"
			" or coach in ({coaches})"
			")"
			" or `tabDiagram`.`created_by` = {user})"
		).format(
			cohorts=_get_active_assignment_cohort_subquery(instructor),
			coaches=_get_assigned_coach_subquery(instructor),
			user=frappe.db.escape(user),
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			"(`tabDiagram`.`linked_session_plan` in ("
			"select name from `tabSession Plan` where coach = {coach}"
			")"
			" or `tabDiagram`.`created_by` = {user})"
		).format(coach=frappe.db.escape(coach), user=frappe.db.escape(user))

	return "1=0"


def coach_profile_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return "`tabCoach Profile`.`cohort` in ({cohorts})".format(
			cohorts=_get_active_assignment_cohort_subquery(instructor)
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return "`tabCoach Profile`.`name` = {coach}".format(coach=frappe.db.escape(coach))

	return "1=0"


def instructor_profile_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	instructor = get_instructor_profile_for_user(user)
	if instructor:
		return "`tabInstructor Profile`.`name` = {instructor}".format(
			instructor=frappe.db.escape(instructor)
		)

	return "1=0"


def assignment_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	conditions = []
	instructor = get_instructor_profile_for_user(user)
	if instructor:
		conditions.append(
			"`tabAssignment`.`instructor` = {instructor}".format(
				instructor=frappe.db.escape(instructor)
			)
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		conditions.append(
			"`tabAssignment`.`cohort` = (select cohort from `tabCoach Profile`"
			" where name = {coach} and ifnull(cohort, '') != '')".format(
				coach=frappe.db.escape(coach)
			)
		)

	if conditions:
		return " or ".join(conditions)

	return "1=0"


def cohort_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return "`tabCohort`.`name` in ({cohorts})".format(
			cohorts=_get_active_assignment_cohort_subquery(instructor)
		)

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			"`tabCohort`.`name` = (select cohort from `tabCoach Profile`"
			" where name = {coach} and ifnull(cohort, '') != '')"
		).format(coach=frappe.db.escape(coach))

	return "1=0"


def license_program_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"`tabLicense Program`.`name` in ("
			"select license_program from `tabCohort` where name in ("
			"{cohorts}"
			") and ifnull(license_program, '') != ''"
			")"
		).format(cohorts=_get_active_assignment_cohort_subquery(instructor))

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			"`tabLicense Program`.`name` in ("
			"select license_program from `tabCoach Profile`"
			" where name = {coach} and ifnull(license_program, '') != ''"
			")"
			" or `tabLicense Program`.`name` in ("
			"select license_program from `tabCohort` where name = ("
			"select cohort from `tabCoach Profile`"
			" where name = {coach} and ifnull(cohort, '') != ''"
			") and ifnull(license_program, '') != ''"
			")"
		).format(coach=frappe.db.escape(coach))

	return "1=0"


def rubric_template_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Instructor", user):
		instructor = get_instructor_profile_for_user(user)
		if not instructor:
			return "1=0"
		return (
			"`tabRubric Template`.`license_program` in ("
			"select license_program from `tabCohort` where name in ("
			"{cohorts}"
			") and ifnull(license_program, '') != ''"
			")"
		).format(cohorts=_get_active_assignment_cohort_subquery(instructor))

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			"`tabRubric Template`.`license_program` in ("
			"select license_program from `tabCoach Profile`"
			" where name = {coach} and ifnull(license_program, '') != ''"
			")"
			" or `tabRubric Template`.`license_program` in ("
			"select license_program from `tabCohort` where name = ("
			"select cohort from `tabCoach Profile`"
			" where name = {coach} and ifnull(cohort, '') != ''"
			") and ifnull(license_program, '') != ''"
			")"
		).format(coach=frappe.db.escape(coach))

	return "1=0"


def file_permission_query_conditions(user):
	if _has_full_access(user):
		return ""

	if user_has_role("Coach", user) and not user_has_role("Instructor", user):
		return "(`tabFile`.`owner` = {user} or `tabFile`.`is_private` = 0)".format(
			user=frappe.db.escape(user)
		)

	return ""


def has_session_plan_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	coach = get_coach_profile_for_user(user)
	if coach and doc.coach == coach:
		return True

	instructor = get_instructor_profile_for_user(user)
	if instructor:
		cohort = doc.cohort
		if not cohort and doc.coach:
			cohort = frappe.db.get_value("Coach Profile", doc.coach, "cohort")
		return _instructor_has_cohort_assignment(instructor, cohort)

	return False


def has_evaluation_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	coach = get_coach_profile_for_user(user)
	if coach and doc.coach == coach:
		return True

	instructor = get_instructor_profile_for_user(user)
	if instructor:
		cohort = doc.cohort
		if not cohort and doc.coach:
			cohort = frappe.db.get_value("Coach Profile", doc.coach, "cohort")
		if _instructor_has_cohort_assignment(instructor, cohort):
			return True

	return False


def has_review_comment_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	session_plan = frappe.db.get_value("Session Plan", doc.session_plan, ["coach"], as_dict=True)
	if not session_plan:
		return False

	coach = get_coach_profile_for_user(user)
	if coach and session_plan.coach == coach:
		return True

	instructor = get_instructor_profile_for_user(user)
	if instructor:
		cohort = frappe.db.get_value("Session Plan", doc.session_plan, "cohort")
		if not cohort and session_plan.coach:
			cohort = frappe.db.get_value("Coach Profile", session_plan.coach, "cohort")
		return _instructor_has_cohort_assignment(instructor, cohort)

	return False


def has_diagram_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	if ptype == "create":
		return user_has_role("Coach", user)

	if not doc:
		return False

	if doc.created_by == user:
		return True

	if doc.linked_session_plan:
		plan = frappe.get_doc("Session Plan", doc.linked_session_plan)
		return has_session_plan_permission(plan, ptype, user)

	return False


def has_coach_profile_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	coach = get_coach_profile_for_user(user)
	if coach:
		return doc.name == coach

	instructor = get_instructor_profile_for_user(user)
	return _instructor_has_cohort_assignment(instructor, doc.cohort)


def has_instructor_profile_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	instructor = get_instructor_profile_for_user(user)
	return doc.name == instructor


def has_assignment_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	instructor = get_instructor_profile_for_user(user)
	if instructor and doc.instructor == instructor:
		return True

	coach = get_coach_profile_for_user(user)
	if coach:
		coach_cohort = frappe.db.get_value("Coach Profile", coach, "cohort")
		if coach_cohort and doc.cohort == coach_cohort:
			return True

	return False


def has_cohort_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	coach = get_coach_profile_for_user(user)
	if coach:
		return (
			doc.name
			== frappe.db.get_value("Coach Profile", coach, "cohort")
			if coach
			else False
		)

	instructor = get_instructor_profile_for_user(user)
	if not instructor:
		return False

	return _instructor_has_cohort_assignment(instructor, doc.name)


def has_license_program_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	coach = get_coach_profile_for_user(user)
	if coach:
		coach_profile = frappe.db.get_value(
			"Coach Profile", coach, ["license_program", "cohort"], as_dict=True
		)
		if not coach_profile:
			return False
		if coach_profile.license_program == doc.name:
			return True
		if coach_profile.cohort:
			return (
				frappe.db.get_value("Cohort", coach_profile.cohort, "license_program")
				== doc.name
			)
		return False

	instructor = get_instructor_profile_for_user(user)
	if not instructor:
		return False

	cohorts = get_assigned_cohorts_for_instructor(instructor)
	if not cohorts:
		return False

	return bool(
		frappe.db.exists("Cohort", {"name": ["in", cohorts], "license_program": doc.name})
	)

	return False


def has_rubric_template_permission(doc, ptype, user):
	if _has_full_access(user):
		return True

	license_program = doc.license_program
	if not license_program:
		return False

	coach = get_coach_profile_for_user(user)
	if coach:
		coach_profile = frappe.db.get_value(
			"Coach Profile", coach, ["license_program", "cohort"], as_dict=True
		)
		if not coach_profile:
			return False
		if coach_profile.license_program == license_program:
			return True
		if coach_profile.cohort:
			return (
				frappe.db.get_value("Cohort", coach_profile.cohort, "license_program")
				== license_program
			)
		return False

	instructor = get_instructor_profile_for_user(user)
	if not instructor:
		return False

	cohorts = get_assigned_cohorts_for_instructor(instructor)
	if not cohorts:
		return False

	return bool(
		frappe.db.exists("Cohort", {"name": ["in", cohorts], "license_program": license_program})
	)

	return False


def has_file_permission(doc, ptype, user, debug=False):
	if _has_full_access(user):
		return True

	if user_has_role("Coach", user) and not user_has_role("Instructor", user):
		if doc.is_private and doc.owner != user:
			return False

	return True
