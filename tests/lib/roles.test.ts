import { describe, it, expect } from "vitest"
import { hasPermission } from "../../lib/roles"
import { UserRole } from "../../types/database"
import { createMockUser } from "../utility/testUtils"

describe("hasPermission Function", () => {
	// --- Mock Users ---
	const ownerId = "owner-uuid-test"
	const leaderId = "leader-uuid-test"
	const employeeId = "employee-uuid-test"
	const otherEmployeeId = "other-employee-uuid-test"
	const adminId = "admin-uuid-test"

	const companyId = "company-uuid-test"
	const otherCompanyId = "other-company-uuid-test"

	const ownerUser = createMockUser(UserRole.Owner, ownerId, companyId)
	const leaderUser = createMockUser(UserRole.Leader, leaderId, companyId)
	const employeeUser = createMockUser(UserRole.Employee, employeeId, companyId)
	const adminUser = createMockUser(UserRole.Admin, adminId, null)

	// --- Ticket Permissions ---
	describe("Ticket Permissions", () => {
		const ownTicketData = { userId: employeeId, companyId: companyId }
		const companyTicketData = { userId: ownerId, companyId: companyId }
		const adminTicketData = { userId: adminId, companyId: null }
		const leaderOwnTicketData = { userId: leaderId, companyId: companyId }

		// Employee Checks
		it("Employee: view own, create company/admin, !delete, !close, respond own", () => {
			expect(hasPermission(employeeUser, "tickets", "view", ownTicketData)).toBe(true)
			expect(hasPermission(employeeUser, "tickets", "view", companyTicketData)).toBe(false)
			expect(hasPermission(employeeUser, "tickets", "create", { userId: employeeId, companyId: companyId })).toBe(true)
			expect(hasPermission(employeeUser, "tickets", "create", { userId: employeeId, companyId: null })).toBe(true) // To admin
			expect(hasPermission(employeeUser, "tickets", "delete", ownTicketData)).toBe(false)
			expect(hasPermission(employeeUser, "tickets", "close", ownTicketData)).toBe(false)
			expect(hasPermission(employeeUser, "tickets", "respond", ownTicketData)).toBe(true)
			expect(hasPermission(employeeUser, "tickets", "respond", companyTicketData)).toBe(false)
		})

		// Leader Checks
		it("Leader: view own/company, create company/admin, delete/close company, respond own/company", () => {
			expect(hasPermission(leaderUser, "tickets", "view", leaderOwnTicketData)).toBe(true)
			expect(hasPermission(leaderUser, "tickets", "view", ownTicketData)).toBe(true) // Employee in same company
			expect(hasPermission(leaderUser, "tickets", "view", adminTicketData)).toBe(false)
			expect(hasPermission(leaderUser, "tickets", "create", { userId: leaderId, companyId: companyId })).toBe(true)
			expect(hasPermission(leaderUser, "tickets", "create", { userId: leaderId, companyId: null })).toBe(true) // To admin
			expect(hasPermission(leaderUser, "tickets", "delete", companyTicketData)).toBe(true)
			expect(hasPermission(leaderUser, "tickets", "close", companyTicketData)).toBe(true)
			expect(hasPermission(leaderUser, "tickets", "respond", leaderOwnTicketData)).toBe(true)
			expect(hasPermission(leaderUser, "tickets", "respond", ownTicketData)).toBe(true) // Employee in same company
		})

		// Owner Checks
		it("Owner: view own/company, create company/admin, delete/close company, respond own/company", () => {
			const ownerOwnTicket = { userId: ownerId, companyId: companyId }
			expect(hasPermission(ownerUser, "tickets", "view", ownerOwnTicket)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "view", ownTicketData)).toBe(true) // Employee in owner's company
			expect(hasPermission(ownerUser, "tickets", "create", { userId: ownerId, companyId: companyId })).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "create", { userId: ownerId, companyId: null })).toBe(true) // To admin
			expect(hasPermission(ownerUser, "tickets", "delete", companyTicketData)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "close", companyTicketData)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "respond", ownerOwnTicket)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "respond", ownTicketData)).toBe(true) // Employee in owner's company
		})

		// Admin Checks
		it("Admin: view/delete/close/respond admin tickets only, !create", () => {
			expect(hasPermission(adminUser, "tickets", "view", adminTicketData)).toBe(true)
			expect(hasPermission(adminUser, "tickets", "view", ownTicketData)).toBe(false)
			expect(hasPermission(adminUser, "tickets", "create", adminTicketData)).toBe(false)
			expect(hasPermission(adminUser, "tickets", "delete", adminTicketData)).toBe(true)
			expect(hasPermission(adminUser, "tickets", "close", adminTicketData)).toBe(true)
			expect(hasPermission(adminUser, "tickets", "respond", adminTicketData)).toBe(true)
		})
	})

	// --- Schedule Permissions ---
	describe("Schedule Permissions", () => {
		const employeeSchedule = { userId: employeeId, companyId: companyId, finalized: false }
		const leaderSchedule = { userId: leaderId, companyId: companyId, finalized: false }
		const ownerSchedule = { userId: ownerId, companyId: companyId, finalized: false }
		const finalizedEmployeeSchedule = { userId: employeeId, companyId: companyId, finalized: true }
		const otherCompanySchedule = { userId: otherEmployeeId, companyId: otherCompanyId, finalized: false }

		// --- View ---
		it("View: Employee views own; Leader/Owner view company; Admin views none", () => {
			expect(hasPermission(employeeUser, "schedule", "view", employeeSchedule)).toBe(true)
			expect(hasPermission(employeeUser, "schedule", "view", leaderSchedule)).toBe(false)

			expect(hasPermission(leaderUser, "schedule", "view", employeeSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "view", leaderSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "view", ownerSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "view", otherCompanySchedule)).toBe(false)

			expect(hasPermission(ownerUser, "schedule", "view", employeeSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "view", leaderSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "view", ownerSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "view", otherCompanySchedule)).toBe(false)

			expect(hasPermission(adminUser, "schedule", "view", employeeSchedule)).toBe(false)
		})

		// --- Create ---
		it("Create: Employee creates for self; Leader/Owner create for company", () => {
			// Employee
			expect(hasPermission(employeeUser, "schedule", "create", {
				userId: employeeId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Self
			expect(hasPermission(employeeUser, "schedule", "create", {
				userId: leaderId,
				companyId: companyId,
				finalized: false
			})).toBe(false) // Other user
			expect(hasPermission(employeeUser, "schedule", "create", {
				userId: ownerId,
				companyId: companyId,
				finalized: false
			})).toBe(false) // Other user

			// Leader (Rule: companyId matches; specific denial for Owner is in route handler)
			expect(hasPermission(leaderUser, "schedule", "create", {
				userId: leaderId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Self
			expect(hasPermission(leaderUser, "schedule", "create", {
				userId: employeeId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Employee in company
			expect(hasPermission(leaderUser, "schedule", "create", {
				userId: "other-leader-id",
				companyId: companyId,
				finalized: false
			})).toBe(true) // Other Leader in company
			expect(hasPermission(leaderUser, "schedule", "create", {
				userId: ownerId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Owner in company (base rule allows, route blocks)
			expect(hasPermission(leaderUser, "schedule", "create", {
				userId: otherEmployeeId,
				companyId: otherCompanyId,
				finalized: false
			})).toBe(false) // Other company

			// Owner (Rule: companyId matches)
			expect(hasPermission(ownerUser, "schedule", "create", {
				userId: ownerId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Self
			expect(hasPermission(ownerUser, "schedule", "create", {
				userId: leaderId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Leader in company
			expect(hasPermission(ownerUser, "schedule", "create", {
				userId: employeeId,
				companyId: companyId,
				finalized: false
			})).toBe(true) // Employee in company
			expect(hasPermission(ownerUser, "schedule", "create", {
				userId: otherEmployeeId,
				companyId: otherCompanyId,
				finalized: false
			})).toBe(false) // Other company

			// Admin
			expect(hasPermission(adminUser, "schedule", "create", {
				userId: adminId,
				companyId: null,
				finalized: false
			})).toBe(false)
		})

		// --- Update ---
		it("Update: Employee updates own non-finalized; Leader/Owner update any company", () => {
			expect(hasPermission(employeeUser, "schedule", "update", employeeSchedule)).toBe(true)
			expect(hasPermission(employeeUser, "schedule", "update", finalizedEmployeeSchedule)).toBe(false) // Finalized
			expect(hasPermission(employeeUser, "schedule", "update", leaderSchedule)).toBe(false) // Other user

			expect(hasPermission(leaderUser, "schedule", "update", employeeSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "update", finalizedEmployeeSchedule)).toBe(true) // Leader can update finalized
			expect(hasPermission(leaderUser, "schedule", "update", otherCompanySchedule)).toBe(false)

			expect(hasPermission(ownerUser, "schedule", "update", employeeSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "update", finalizedEmployeeSchedule)).toBe(true) // Owner can update finalized
			expect(hasPermission(ownerUser, "schedule", "update", otherCompanySchedule)).toBe(false)
		})

		// --- Delete ---
		it("Delete: Employee deletes own non-finalized; Leader/Owner delete any company", () => {
			expect(hasPermission(employeeUser, "schedule", "delete", employeeSchedule)).toBe(true)
			expect(hasPermission(employeeUser, "schedule", "delete", finalizedEmployeeSchedule)).toBe(false) // Finalized
			expect(hasPermission(employeeUser, "schedule", "delete", leaderSchedule)).toBe(false) // Other user

			expect(hasPermission(leaderUser, "schedule", "delete", employeeSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "delete", finalizedEmployeeSchedule)).toBe(true) // Leader can delete finalized
			expect(hasPermission(leaderUser, "schedule", "delete", otherCompanySchedule)).toBe(false)

			expect(hasPermission(ownerUser, "schedule", "delete", employeeSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "delete", finalizedEmployeeSchedule)).toBe(true) // Owner can delete finalized
			expect(hasPermission(ownerUser, "schedule", "delete", otherCompanySchedule)).toBe(false)
		})

		// --- Finalize ---
		it("Finalize: Only Leader/Owner can finalize company schedules", () => {
			expect(hasPermission(employeeUser, "schedule", "finalize", employeeSchedule)).toBe(false)
			expect(hasPermission(leaderUser, "schedule", "finalize", employeeSchedule)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "finalize", employeeSchedule)).toBe(true)
			expect(hasPermission(leaderUser, "schedule", "finalize", otherCompanySchedule)).toBe(false)
			expect(hasPermission(adminUser, "schedule", "finalize", employeeSchedule)).toBe(false)
		})
	})

	// --- Training Permissions ---
	describe("Training Permissions", () => {
		const employeeTrainingData = { companyId: companyId, role: UserRole.Employee }
		const leaderTrainingData = { companyId: companyId, role: UserRole.Leader }
		const otherCompanyTraining = { companyId: otherCompanyId, role: UserRole.Employee }

		// Employee
		it("Employee: View Employee training in company; No CUD", () => {
			expect(hasPermission(employeeUser, "training", "view", employeeTrainingData)).toBe(true)
			expect(hasPermission(employeeUser, "training", "view", leaderTrainingData)).toBe(false)
			expect(hasPermission(employeeUser, "training", "view", otherCompanyTraining)).toBe(false)
			expect(hasPermission(employeeUser, "training", "create", employeeTrainingData)).toBe(false)
			expect(hasPermission(employeeUser, "training", "update", employeeTrainingData)).toBe(false)
			expect(hasPermission(employeeUser, "training", "delete", employeeTrainingData)).toBe(false)
		})

		// Leader
		it("Leader: View/Create/Update/Delete any training in company", () => {
			expect(hasPermission(leaderUser, "training", "view", employeeTrainingData)).toBe(true)
			expect(hasPermission(leaderUser, "training", "view", leaderTrainingData)).toBe(true)
			expect(hasPermission(leaderUser, "training", "view", otherCompanyTraining)).toBe(false)
			expect(hasPermission(leaderUser, "training", "create", employeeTrainingData)).toBe(true)
			expect(hasPermission(leaderUser, "training", "update", leaderTrainingData)).toBe(true)
			expect(hasPermission(leaderUser, "training", "delete", employeeTrainingData)).toBe(true)
		})

		// Owner
		it("Owner: View/Create/Update/Delete any training in company", () => {
			expect(hasPermission(ownerUser, "training", "view", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "view", leaderTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "create", leaderTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "update", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "delete", leaderTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "view", otherCompanyTraining)).toBe(false)
		})

		// Admin
		it("Admin: No training access", () => {
			expect(hasPermission(adminUser, "training", "view", employeeTrainingData)).toBe(false)
			expect(hasPermission(adminUser, "training", "create", leaderTrainingData)).toBe(false)
		})
	})

	// --- Submission Permissions ---
	describe("Submission Permissions", () => {
		const employeeSubmittingSelf = { companyId: companyId, role: UserRole.Employee, userId: employeeId }
		const employeeSubmittingLeaderTraining = { companyId: companyId, role: UserRole.Leader, userId: employeeId } // Employee trying to submit Leader training
		const leaderSubmittingEmployee = { companyId: companyId, role: UserRole.Employee, userId: employeeId } // Leader viewing Employee submission
		const leaderSubmittingLeader = { companyId: companyId, role: UserRole.Leader, userId: leaderId } // Leader viewing/submitting own Leader training
		const otherCompanySubmission = { companyId: otherCompanyId, role: UserRole.Employee, userId: otherEmployeeId }

		// Employee
		it("Employee: View own subs; Create for Employee training in company", () => {
			expect(hasPermission(employeeUser, "submission", "view", employeeSubmittingSelf)).toBe(true)
			expect(hasPermission(employeeUser, "submission", "view", leaderSubmittingEmployee)).toBe(true) // Cannot view other's subs
			expect(hasPermission(employeeUser, "submission", "create", employeeSubmittingSelf)).toBe(true) // Can submit for Employee training
			expect(hasPermission(employeeUser, "submission", "create", employeeSubmittingLeaderTraining)).toBe(false) // Cannot submit for Leader training
			expect(hasPermission(employeeUser, "submission", "create", otherCompanySubmission)).toBe(false) // Other company
		})

		// Leader
		it("Leader: View all company subs; Create for any training role in company", () => {
			expect(hasPermission(leaderUser, "submission", "view", employeeSubmittingSelf)).toBe(true) // Can view employee's sub
			expect(hasPermission(leaderUser, "submission", "view", leaderSubmittingLeader)).toBe(true) // Can view own sub
			expect(hasPermission(leaderUser, "submission", "view", otherCompanySubmission)).toBe(false) // Other company
			expect(hasPermission(leaderUser, "submission", "create", leaderSubmittingEmployee)).toBe(true) // Can submit for Employee role
			expect(hasPermission(leaderUser, "submission", "create", leaderSubmittingLeader)).toBe(true) // Can submit for Leader role
		})

		// Owner
		it("Owner: View all company subs; Create for any training role in company", () => {
			expect(hasPermission(ownerUser, "submission", "view", employeeSubmittingSelf)).toBe(true)
			expect(hasPermission(ownerUser, "submission", "view", leaderSubmittingLeader)).toBe(true)
			expect(hasPermission(ownerUser, "submission", "view", otherCompanySubmission)).toBe(false)
			expect(hasPermission(ownerUser, "submission", "create", leaderSubmittingEmployee)).toBe(true)
			expect(hasPermission(ownerUser, "submission", "create", leaderSubmittingLeader)).toBe(true)
		})

		// Admin
		it("Admin: No submission access", () => {
			expect(hasPermission(adminUser, "submission", "view", employeeSubmittingSelf)).toBe(false)
			expect(hasPermission(adminUser, "submission", "create", employeeSubmittingSelf)).toBe(false)
		})
	})
})