import { describe, it, expect } from "bun:test"
import { hasPermission } from "../../lib/roles"
import { UserRole } from "../../types/database"
import type { User } from "@supabase/supabase-js"

// Mock User object generator
const createMockUser = (role: UserRole, userId: string, companyId: string | null): User => ({
	id: userId,
	app_metadata: {},
	user_metadata: {
		role: role,
		company_id: companyId,
		name: "Test User",
		verified: true,
		created_at: new Date().toISOString()
	},
	aud: "authenticated",
	created_at: new Date().toISOString()
})

describe("hasPermission Function", () => {
	const ownerId = "owner-uuid"
	const employeeId = "employee-uuid"
	const companyId = "company-uuid"
	const otherCompanyId = "other-company-uuid"
	const adminId = "admin-uuid"

	const ownerUser = createMockUser(UserRole.Owner, ownerId, companyId)
	const employeeUser = createMockUser(UserRole.Employee, employeeId, companyId)
	const adminUser = createMockUser(UserRole.Admin, adminId, null)

	// --- Ticket Permissions ---
	describe("Ticket Permissions", () => {
		const ownTicketData = { userId: employeeId, companyId: companyId }
		const companyTicketData = { userId: ownerId, companyId: companyId } // Ticket created by owner in same company
		const adminTicketData = { userId: adminId, companyId: null } // Ticket for admins

		it("Employee should view own tickets, but not others", () => {
			expect(hasPermission(employeeUser, "tickets", "view", ownTicketData)).toBe(true)
			expect(hasPermission(employeeUser, "tickets", "view", companyTicketData)).toBe(false)
			expect(hasPermission(employeeUser, "tickets", "view", adminTicketData)).toBe(false)
		})

		it("Owner should view own and company tickets", () => {
			const ownerOwnTicket = { userId: ownerId, companyId: companyId }
			expect(hasPermission(ownerUser, "tickets", "view", ownerOwnTicket)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "view", ownTicketData)).toBe(true) // Employee's ticket in owner's company
			expect(hasPermission(ownerUser, "tickets", "view", {
				userId: "other-employee",
				companyId: otherCompanyId
			})).toBe(false) // Different company
			expect(hasPermission(ownerUser, "tickets", "view", adminTicketData)).toBe(false)
		})

		it("Admin should view admin tickets only", () => {
			expect(hasPermission(adminUser, "tickets", "view", adminTicketData)).toBe(true)
			expect(hasPermission(adminUser, "tickets", "view", ownTicketData)).toBe(false)
			expect(hasPermission(adminUser, "tickets", "view", companyTicketData)).toBe(false)
		})

		it("Employee should create tickets for their company or admins", () => {
			expect(hasPermission(employeeUser, "tickets", "create", { userId: employeeId, companyId: companyId })).toBe(true)
			expect(hasPermission(employeeUser, "tickets", "create", { userId: employeeId, companyId: null })).toBe(true) // To admin
			expect(hasPermission(employeeUser, "tickets", "create", {
				userId: employeeId,
				companyId: otherCompanyId
			})).toBe(false)
		})

		it("Owner should close company tickets", () => {
			expect(hasPermission(ownerUser, "tickets", "close", companyTicketData)).toBe(true)
			expect(hasPermission(ownerUser, "tickets", "close", adminTicketData)).toBe(false)
		})

		it("Employee should not close tickets", () => {
			expect(hasPermission(employeeUser, "tickets", "close", ownTicketData)).toBe(false)
		})
	})

	// --- Schedule Permissions ---
	describe("Schedule Permissions", () => {
		const ownScheduleData = { userId: employeeId, companyId: companyId, finalized: false }
		const companyScheduleData = { userId: ownerId, companyId: companyId, finalized: false }
		const finalizedScheduleData = { userId: employeeId, companyId: companyId, finalized: true }


		it("Employee should view & update own non-finalized schedule", () => {
			expect(hasPermission(employeeUser, "schedule", "view", ownScheduleData)).toBe(true)
			expect(hasPermission(employeeUser, "schedule", "update", ownScheduleData)).toBe(true)
			expect(hasPermission(employeeUser, "schedule", "delete", ownScheduleData)).toBe(true)
		})

		it("Employee should not view/update/delete other's schedules", () => {
			expect(hasPermission(employeeUser, "schedule", "view", companyScheduleData)).toBe(false)
			expect(hasPermission(employeeUser, "schedule", "update", companyScheduleData)).toBe(false)
			expect(hasPermission(employeeUser, "schedule", "delete", companyScheduleData)).toBe(false)
		})

		it("Employee should not update/delete finalized schedules", () => {
			expect(hasPermission(employeeUser, "schedule", "update", finalizedScheduleData)).toBe(false)
			expect(hasPermission(employeeUser, "schedule", "delete", finalizedScheduleData)).toBe(false)
		})

		it("Owner should view, update, delete, and finalize company schedules", () => {
			expect(hasPermission(ownerUser, "schedule", "view", ownScheduleData)).toBe(true) // Employee's schedule in owner's company
			expect(hasPermission(ownerUser, "schedule", "view", companyScheduleData)).toBe(true) // Owner's schedule
			expect(hasPermission(ownerUser, "schedule", "update", ownScheduleData)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "delete", ownScheduleData)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "finalize", ownScheduleData)).toBe(true)
			expect(hasPermission(ownerUser, "schedule", "view", {
				userId: "any",
				companyId: otherCompanyId,
				finalized: false
			})).toBe(false) // Different company
		})

		it("Admin should not access schedules", () => {
			expect(hasPermission(adminUser, "schedule", "view", ownScheduleData)).toBe(false)
			expect(hasPermission(adminUser, "schedule", "create", ownScheduleData)).toBe(false)
		})
	})

	// --- Training Permissions ---
	describe("Training Permissions", () => {
		const employeeTrainingData = { companyId: companyId, role: UserRole.Employee }
		const leaderTrainingData = { companyId: companyId, role: UserRole.Leader }


		it("Employee should view Employee training in their company", () => {
			expect(hasPermission(employeeUser, "training", "view", employeeTrainingData)).toBe(true)
			expect(hasPermission(employeeUser, "training", "view", leaderTrainingData)).toBe(false) // Cannot view leader training
			expect(hasPermission(employeeUser, "training", "view", {
				companyId: otherCompanyId,
				role: UserRole.Employee
			})).toBe(false) // Different company
		})

		it("Employee should not create/update/delete training", () => {
			expect(hasPermission(employeeUser, "training", "create", employeeTrainingData)).toBe(false)
			expect(hasPermission(employeeUser, "training", "update", employeeTrainingData)).toBe(false)
			expect(hasPermission(employeeUser, "training", "delete", employeeTrainingData)).toBe(false)
		})

		it("Owner should view/create/update/delete any training in their company", () => {
			expect(hasPermission(ownerUser, "training", "view", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "view", leaderTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "create", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "update", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "delete", employeeTrainingData)).toBe(true)
			expect(hasPermission(ownerUser, "training", "view", {
				companyId: otherCompanyId,
				role: UserRole.Employee
			})).toBe(false) // Different company
		})
	})

	// --- Submission Permissions ---
	describe("Submission Permissions", () => {
		const employeeSubmissionData = { companyId: companyId, role: UserRole.Employee, userId: employeeId }
		const otherEmployeeSubmissionData = { companyId: companyId, role: UserRole.Employee, userId: "other-employee-id" }

		it("Employee should view & create own submissions for Employee training", () => {
			expect(hasPermission(employeeUser, "submission", "view", employeeSubmissionData)).toBe(true)
			// Note: 'create' permission checks if the user *can* submit for a specific training role/company
			expect(hasPermission(employeeUser, "submission", "create", {
				companyId: companyId,
				role: UserRole.Employee,
				userId: employeeId
			})).toBe(true)
		})

		it("Employee should not view others' submissions or create for other roles", () => {
			expect(hasPermission(employeeUser, "submission", "view", otherEmployeeSubmissionData)).toBe(false)
			expect(hasPermission(employeeUser, "submission", "create", {
				companyId: companyId,
				role: UserRole.Leader,
				userId: employeeId
			})).toBe(false) // Cannot submit for leader training
			expect(hasPermission(employeeUser, "submission", "create", {
				companyId: otherCompanyId,
				role: UserRole.Employee,
				userId: employeeId
			})).toBe(false) // Different company
		})

		it("Owner should view all submissions in their company", () => {
			expect(hasPermission(ownerUser, "submission", "view", employeeSubmissionData)).toBe(true)
			expect(hasPermission(ownerUser, "submission", "view", otherEmployeeSubmissionData)).toBe(true)
			expect(hasPermission(ownerUser, "submission", "view", {
				companyId: otherCompanyId,
				role: UserRole.Employee,
				userId: "any"
			})).toBe(false) // Different company
		})

		it("Owner should be able to 'create' (implies submitting is allowed for their company)", () => {
			// The 'create' check here is more about "can submissions happen in this context"
			expect(hasPermission(ownerUser, "submission", "create", {
				companyId: companyId,
				role: UserRole.Employee,
				userId: "any"
			})).toBe(true)
			expect(hasPermission(ownerUser, "submission", "create", {
				companyId: companyId,
				role: UserRole.Leader,
				userId: "any"
			})).toBe(true)
		})
	})
})