import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import request from "supertest"
import { Pool } from "pg"
import app from "../../index"
import { UserRole } from "../../types/database"

import { MOCK_OWNER_ID, MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID } from "../utility/testUtils"

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:54322/postgres"
const pool = new Pool({ connectionString: testDbConnectionString })

const supabaseId = process.env.SUPABASE_ID || "test_project"

function createAuthCookie(token: string): string {
	const cookieData = JSON.stringify({ access_token: token })
	const base64Data = Buffer.from(cookieData).toString("base64")
	return `sb-${supabaseId}-auth-token=base64-${base64Data}`
}

const OWNER_COOKIE = createAuthCookie("TEST_OWNER_TOKEN")
const EMPLOYEE_COOKIE = createAuthCookie("TEST_EMPLOYEE_TOKEN")


// --- Test Suite Setup/Teardown ---
beforeAll(async () => {
	try {
		await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)
                      ON CONFLICT(id) DO NOTHING`, [MOCK_COMPANY_ID, "Test Seed Company", "SEEDCODE"])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name,
                                                    role = EXCLUDED.role,
                                                    company_id = EXCLUDED.company_id,
                                                    verified = EXCLUDED.verified,
                                                    age = EXCLUDED.age`,
			[MOCK_OWNER_ID, "Seed Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name,
                                                    role = EXCLUDED.role,
                                                    company_id = EXCLUDED.company_id,
                                                    verified = EXCLUDED.verified,
                                                    age = EXCLUDED.age`,
			[MOCK_EMPLOYEE_ID, "Seed Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		console.log("Test DB seeded.")
	} catch (err) {
		console.error("Seeding failed:", err)
		throw err
	}
})

afterEach(async () => {
	await pool.query(`DELETE
                    FROM public.schedule`) // Clean all schedules after each test
})

afterAll(async () => {
	// Clean up global seeded data and close pool
	console.log("Cleaning up test DB...")
	await pool.query(`DELETE
                    FROM public.schedule`)
	await pool.query(`DELETE
                    FROM public."user"
                    WHERE id IN ($1, $2)`, [MOCK_OWNER_ID, MOCK_EMPLOYEE_ID])
	await pool.query(`DELETE
                    FROM public.company
                    WHERE id = $1`, [MOCK_COMPANY_ID])
	await pool.end()
	console.log("Test DB cleanup complete.")
})


// --- Tests ---
describe("Schedule API Integration Tests", () => {

	describe("GET /schedule", () => {
		it("should retrieve schedule data for the authenticated owner", async () => {
			// Arrange: Insert a schedule linked to the seeded owner/company
			const startTime = new Date()
			const endTime = new Date(startTime.getTime() + 4 * 3600 * 1000)
			await pool.query(`INSERT INTO public.schedule (user_id, company_id, start, "end", category, finalized)
                        VALUES ($1, $2, $3, $4, $5, $6)`,
				[MOCK_OWNER_ID, MOCK_COMPANY_ID, startTime, endTime, 1, false])

			// Act: Make request with owner authentication cookie
			const response = await request(app)
				.get("/schedule")
				.set("Cookie", [OWNER_COOKIE])

			// Assert
			expect(response.status).toBe(200)
			expect(response.body.status).toBe("ignore")
			expect(response.body.data).toHaveProperty("weekStart")
			expect(response.body.data.schedule).toBeInstanceOf(Object)
		})

		it("should retrieve only own schedule data for an employee", async () => {
			// Arrange: Insert schedules for both owner and employee
			const ownerStartTime = new Date(Date.now() - 24 * 3600 * 1000) // Yesterday
			const ownerEndTime = new Date(ownerStartTime.getTime() + 8 * 3600 * 1000)
			const empStartTime = new Date()
			const empEndTime = new Date(empStartTime.getTime() + 6 * 3600 * 1000)
			await pool.query(`INSERT INTO public.schedule (user_id, company_id, start, "end", category, finalized)
                        VALUES ($1, $2, $3, $4, $5, $6),
                               ($7, $8, $9, $10, $11, $12)`,
				[MOCK_OWNER_ID, MOCK_COMPANY_ID, ownerStartTime, ownerEndTime, 1, false,
					MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID, empStartTime, empEndTime, 1, false])

			// Act: Make request with employee authentication cookie
			const response = await request(app)
				.get("/schedule")
				.set("Cookie", [EMPLOYEE_COOKIE])

			// Assert
			expect(response.status).toBe(200)
			const scheduleKeys = Object.keys(response.body.data.schedule)
			expect(scheduleKeys.length).toBeGreaterThan(0)
		})
	})

	describe("POST /schedule", () => {
		it("should allow Owner to create a schedule for an Employee", async () => {
			const startTime = new Date(Date.now() + 48 * 3600 * 1000) // 2 days from now
			const endTime = new Date(startTime.getTime() + 8 * 3600 * 1000)

			const scheduleData = {
				start: startTime.toISOString(),
				end: endTime.toISOString(),
				category: 1,
				companyId: MOCK_COMPANY_ID,
				userIds: [MOCK_EMPLOYEE_ID]
			}

			// Act
			const response = await request(app)
				.post("/schedule")
				.set("Cookie", [OWNER_COOKIE])
				.send(scheduleData)

			// Assert Response
			expect(response.status).toBe(201)
			expect(response.body.status).toBe("success")

			// Assert Database State
			const dbResult = await pool.query("SELECT * FROM public.schedule WHERE user_id = $1", [MOCK_EMPLOYEE_ID])
			expect(dbResult.rowCount).toBe(1)
			expect(new Date(dbResult.rows[0].start).getTime()).toBeCloseTo(startTime.getTime())
		})

		it("should prevent Employee from creating a schedule for another user", async () => {
			const startTime = new Date(Date.now() + 72 * 3600 * 1000) // 3 days from now
			const endTime = new Date(startTime.getTime() + 8 * 3600 * 1000)

			const scheduleData = {
				start: startTime.toISOString(),
				end: endTime.toISOString(),
				category: 1,
				companyId: MOCK_COMPANY_ID,
				userIds: [MOCK_OWNER_ID] // Employee trying to schedule Owner
			}

			// Act
			const response = await request(app)
				.post("/schedule")
				.set("Cookie", [EMPLOYEE_COOKIE])
				.send(scheduleData)

			// Assert Response
			expect(response.status).toBe(403) // Expect Forbidden
			expect(response.body.message).toContain("permission to create schedules")

			// Assert Database State (Owner should have no new schedule)
			const dbResult = await pool.query("SELECT * FROM public.schedule WHERE user_id = $1 AND start = $2", [MOCK_OWNER_ID, startTime])
			expect(dbResult.rowCount).toBe(0)
		})

		it("should return 400 if schedule duration is less than 4 hours", async () => {
			const startTime = new Date(Date.now() + 96 * 3600 * 1000)
			const endTime = new Date(startTime.getTime() + 3 * 3600 * 1000) // Only 3 hours

			const scheduleData = {
				start: startTime.toISOString(),
				end: endTime.toISOString(),
				category: 1,
				companyId: MOCK_COMPANY_ID,
				userIds: [MOCK_EMPLOYEE_ID]
			}

			const response = await request(app)
				.post("/schedule")
				.set("Cookie", [OWNER_COOKIE])
				.send(scheduleData)

			expect(response.status).toBe(400)
			expect(response.body.message).toContain("at least 4 hours long")
		})
	})
})