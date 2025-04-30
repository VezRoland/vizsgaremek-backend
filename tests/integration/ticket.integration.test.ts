import {describe, it, expect, afterAll, beforeEach} from "vitest"
import request from "supertest"
import {Pool} from "pg"
import app from "../../index"
import {UserRole} from "../../types/database"
import {
	MOCK_OWNER_ID,
	MOCK_LEADER_ID,
	MOCK_EMPLOYEE_ID,
	MOCK_ADMIN_ID,
	MOCK_COMPANY_ID
} from "../utility/testUtils"

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!
if (!testDbConnectionString) {
	throw new Error("POSTGRES_URL environment variable is not set for tests. Make sure .env.test is loaded.")
}
const pool = new Pool({connectionString: testDbConnectionString})

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`
const OWNER_COOKIE = createAuthCookie("TEST_OWNER_TOKEN")
const LEADER_COOKIE = createAuthCookie("TEST_LEADER_TOKEN")
const EMPLOYEE_COOKIE = createAuthCookie("TEST_EMPLOYEE_TOKEN")
const ADMIN_COOKIE = createAuthCookie("TEST_ADMIN_TOKEN")

// --- Test Constants ---
const TICKET_TITLE = "Help Request"
const TICKET_CONTENT = "My application is broken, please assist."
const RESPONSE_CONTENT = "Have you tried turning it off and on again?"

// --- Test Suite Setup/Teardown ---
beforeEach(async () => {
	// Clean tables before each test for isolation
	try {
		await pool.query(`TRUNCATE public.ticket_response, public.ticket, public."user", public.company RESTART IDENTITY CASCADE`)

		await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
			[MOCK_COMPANY_ID, "Test Seed Company", "SEEDCODE"])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_OWNER_ID, "Seed Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_LEADER_ID, "Seed Leader", UserRole.Leader, MOCK_COMPANY_ID, true, 30])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_EMPLOYEE_ID, "Seed Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_ADMIN_ID, "Seed Admin", UserRole.Admin, null, true, 40])

	} catch (err) {
		console.error("Seeding failed in beforeEach (ticket tests):", err)
		throw err
	}
})

afterAll(async () => {
	console.log("Closing test DB connection pool (ticket tests)...")
	await pool.end()
	console.log("Test DB pool closed (ticket tests).")
})

// --- Helper Functions ---
const createTicketInDb = async (userId: string, companyId: string | null, title: string = TICKET_TITLE, content: string = TICKET_CONTENT, closed: boolean = false): Promise<string> => {
	const res = await pool.query(
		`INSERT INTO public.ticket (user_id, company_id, title, content, closed)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
		[userId, companyId, title, content, closed]
	)
	return res.rows[0].id
}

const createResponseInDb = async (ticketId: string, userId: string, content: string = RESPONSE_CONTENT): Promise<string> => {
	const res = await pool.query(
		`INSERT INTO public.ticket_response (ticket_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id`,
		[ticketId, userId, content]
	)
	return res.rows[0].id
}


// --- Tests ---
describe("Ticket API Integration Tests", () => {

	// =============================================
	// POST /ticket/
	// =============================================
	describe("POST /ticket/", () => {
		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).post("/ticket/").send({
				title: TICKET_TITLE,
				content: TICKET_CONTENT,
				company_id: MOCK_COMPANY_ID
			})
			expect(response.status).toBe(401)
		})

		it("should 400 for invalid data (Zod validation)", async () => {
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({title: "T", content: "Short", company_id: MOCK_COMPANY_ID}) // Invalid title/content length
			expect(response.status).toBe(400)
			expect(response.body.message).toContain("Invalid data")
		})

		it("Employee should create ticket for own company", async () => {
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({title: TICKET_TITLE, content: TICKET_CONTENT, company_id: MOCK_COMPANY_ID})
			expect(response.status).toBe(201)
			expect(response.body.message).toContain("Ticket created successfully")
		})

		it("Employee should create ticket for Admin (company_id: null)", async () => {
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({title: TICKET_TITLE, content: TICKET_CONTENT, company_id: null})
			expect(response.status).toBe(201)
		})

		it("Employee should NOT create ticket for different company", async () => {
			const otherCompanyId = "other-company-uuid-for-test"
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({title: TICKET_TITLE, content: TICKET_CONTENT, company_id: otherCompanyId})
			expect(response.status).toBe(403)
			expect(response.body.message).toContain("You are not authorized to create a ticket!")
		})

		it("Owner should create ticket for own company", async () => {
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", OWNER_COOKIE)
				.send({title: TICKET_TITLE, content: TICKET_CONTENT, company_id: MOCK_COMPANY_ID})
			expect(response.status).toBe(201)
		})

		it("Admin should NOT create ticket", async () => {
			const response = await request(app)
				.post("/ticket/")
				.set("Cookie", ADMIN_COOKIE)
				.send({title: TICKET_TITLE, content: TICKET_CONTENT, company_id: null})
			expect(response.status).toBe(403)
			expect(response.body.message).toContain("not authorized to create a ticket")
		})
	})

	// =============================================
	// GET /ticket/all
	// =============================================
	describe("GET /ticket/all", () => {
		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).get("/ticket/all")
			expect(response.status).toBe(401)
		})

		it("Employee should get only own tickets", async () => {
			const ticket1Id = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID, "My Ticket 1")
			const ticket2Id = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID, "Leader Ticket") // Another user's ticket
			const ticket3Id = await createTicketInDb(MOCK_EMPLOYEE_ID, null, "My Admin Ticket") // Own admin ticket

			const response = await request(app)
				.get("/ticket/all")
				.set("Cookie", EMPLOYEE_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(2) // Only the two tickets created by the employee
			expect(response.body.data.some((t: any) => t.id === ticket1Id)).toBe(true)
			expect(response.body.data.some((t: any) => t.id === ticket3Id)).toBe(true)
			expect(response.body.data.some((t: any) => t.id === ticket2Id)).toBe(false)
		})

		it("Leader should get own tickets and company tickets", async () => {
			const ticket1Id = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID, "Employee Ticket") // Employee ticket
			const ticket2Id = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID, "My Ticket") // Leader's own ticket
			const ticket3Id = await createTicketInDb(MOCK_LEADER_ID, null, "My Admin Ticket") // Leader's admin ticket
			const ticket4Id = await createTicketInDb(MOCK_ADMIN_ID, null, "Admin Only Ticket") // Admin ticket

			const response = await request(app)
				.get("/ticket/all")
				.set("Cookie", LEADER_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(3) // Employee's, Leader's company, Leader's admin
			expect(response.body.data.some((t: any) => t.id === ticket1Id)).toBe(true)
			expect(response.body.data.some((t: any) => t.id === ticket2Id)).toBe(true)
			expect(response.body.data.some((t: any) => t.id === ticket3Id)).toBe(true)
			expect(response.body.data.some((t: any) => t.id === ticket4Id)).toBe(false)
		})

		it("Admin should get only admin tickets (company_id is null)", async () => {
			await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID, "Employee Ticket") // Company ticket
			await createTicketInDb(MOCK_LEADER_ID, null, "Leader Admin Ticket") // User admin ticket

			const response = await request(app)
				.get("/ticket/all")
				.set("Cookie", ADMIN_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(1) // Only the leader's admin ticket
			expect(response.body.data[0].title).toBe("Leader Admin Ticket")
			expect(response.body.data[0].company_id).toBeNull()
		})
	})

	// =============================================
	// GET /ticket/:id
	// =============================================
	describe("GET /ticket/:id", () => {
		it("should 401 for unauthenticated user", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).get(`/ticket/${ticketId}`)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent ticket ID", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app).get(`/ticket/${nonExistentId}`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Employee should get own ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).get(`/ticket/${ticketId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(ticketId)
			expect(response.body.data.user_id).toBe(MOCK_EMPLOYEE_ID)
		})

		it("Employee should NOT get another company member's ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID) // Leader's ticket
			const response = await request(app).get(`/ticket/${ticketId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(404)
			expect(response.body.message).toContain("Ticket not found or you don't have permission")
		})

		it("Owner should get any ticket within their company", async () => {
			const empTicketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const leaderTicketId = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID)

			const res1 = await request(app).get(`/ticket/${empTicketId}`).set("Cookie", OWNER_COOKIE)
			expect(res1.status).toBe(200)
			expect(res1.body.data.id).toBe(empTicketId)

			const res2 = await request(app).get(`/ticket/${leaderTicketId}`).set("Cookie", OWNER_COOKIE)
			expect(res2.status).toBe(200)
			expect(res2.body.data.id).toBe(leaderTicketId)
		})

		it("Admin should get admin ticket (company_id is null)", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, null) // Admin ticket created by employee
			const response = await request(app).get(`/ticket/${ticketId}`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(ticketId)
			expect(response.body.data.company_id).toBeNull()
		})

		it("Admin should NOT get company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Company ticket
			const response = await request(app).get(`/ticket/${ticketId}`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(404)
			expect(response.body.message).toContain("Ticket not found or you don't have permission")
		})

		it("should include responses when ?include_responses is present", async () => {
			const ticketId = await createTicketInDb(MOCK_OWNER_ID, MOCK_COMPANY_ID)
			await createResponseInDb(ticketId, MOCK_EMPLOYEE_ID, "Response 1")
			await createResponseInDb(ticketId, MOCK_OWNER_ID, "Response 2")

			const response = await request(app)
				.get(`/ticket/${ticketId}?include_responses`)
				.set("Cookie", OWNER_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(ticketId)
			expect(response.body.data.responses).toBeInstanceOf(Array)
			expect(response.body.data.responses.length).toBe(2)
			expect(response.body.data.responses[0].content).toBe("Response 1")
			expect(response.body.data.responses[1].content).toBe("Response 2")
		})

		it("should NOT include responses by default", async () => {
			const ticketId = await createTicketInDb(MOCK_OWNER_ID, MOCK_COMPANY_ID)
			await createResponseInDb(ticketId, MOCK_EMPLOYEE_ID)

			const response = await request(app)
				.get(`/ticket/${ticketId}`)
				.set("Cookie", OWNER_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(ticketId)
			expect(response.body.data).not.toHaveProperty("responses")
		})
	})

	// =============================================
	// PATCH /ticket/:id/status
	// =============================================
	describe("PATCH /ticket/:id/status", () => {
		it("should 401 for unauthenticated user", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).patch(`/ticket/${ticketId}/status`)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent ticket ID", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app).patch(`/ticket/${nonExistentId}/status`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Employee should NOT be able to close ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).patch(`/ticket/${ticketId}/status`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(403)
			expect(response.body.message).toContain("not authorized to close this ticket")
		})

		it("Owner should be able to close and re-open a company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID, TICKET_TITLE, TICKET_CONTENT, false) // Start open

			// Close it
			const closeResponse = await request(app).patch(`/ticket/${ticketId}/status`).set("Cookie", OWNER_COOKIE)
			expect(closeResponse.status).toBe(200)
			let dbCheck = await pool.query("SELECT closed FROM ticket WHERE id = $1", [ticketId])
			expect(dbCheck.rows[0].closed).toBe(true)

			// Re-open it
			const openResponse = await request(app).patch(`/ticket/${ticketId}/status`).set("Cookie", OWNER_COOKIE)
			expect(openResponse.status).toBe(200)
			dbCheck = await pool.query("SELECT closed FROM ticket WHERE id = $1", [ticketId])
			expect(dbCheck.rows[0].closed).toBe(false)
		})

		it("Admin should be able to close admin ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_ADMIN_ID, null, TICKET_TITLE, TICKET_CONTENT, false) // Admin ticket
			const response = await request(app).patch(`/ticket/${ticketId}/status`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(200)
			const dbCheck = await pool.query("SELECT closed FROM ticket WHERE id = $1", [ticketId])
			expect(dbCheck.rows[0].closed).toBe(true)
		})

		it("Admin should NOT be able to close company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Company ticket
			const response = await request(app).patch(`/ticket/${ticketId}/status`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(404)
		})
	})

	// =============================================
	// POST /ticket/:id/response
	// =============================================
	describe("POST /ticket/:id/response", () => {
		it("should 401 for unauthenticated user", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).post(`/ticket/${ticketId}/response`).send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent ticket ID", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app)
				.post(`/ticket/${nonExistentId}/response`)
				.set("Cookie", OWNER_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(404)
		})

		it("should 400 for invalid data (Zod)", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({content: "Too short"}) // Content too short
			expect(response.status).toBe(400)
		})

		it("Employee should respond to own ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(201)
			const dbCheck = await pool.query("SELECT COUNT(*) FROM ticket_response WHERE ticket_id = $1 AND user_id = $2", [ticketId, MOCK_EMPLOYEE_ID])
			expect(dbCheck.rows[0].count).toBe("1")
		})

		it("Employee should NOT respond to another company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID) // Leader's ticket
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(404)
		})

		it("Owner should respond to any company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Employee's ticket
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", OWNER_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(201)
		})

		it("Admin should respond to admin ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_ADMIN_ID, null) // Admin ticket
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", ADMIN_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(201)
		})

		it("Admin should NOT respond to company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Company ticket
			const response = await request(app)
				.post(`/ticket/${ticketId}/response`)
				.set("Cookie", ADMIN_COOKIE)
				.send({content: RESPONSE_CONTENT})
			expect(response.status).toBe(404)
		})
	})

	// =============================================
	// GET /ticket/:id/responses
	// =============================================
	describe("GET /ticket/:id/responses", () => {
		it("should 401 for unauthenticated user", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent ticket ID", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app).get(`/ticket/${nonExistentId}/responses`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Employee should get responses for own ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
			await createResponseInDb(ticketId, MOCK_LEADER_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(1)
		})

		it("Employee should NOT get responses for another company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_LEADER_ID, MOCK_COMPANY_ID) // Leader's ticket
			await createResponseInDb(ticketId, MOCK_OWNER_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Owner should get responses for any company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Employee's ticket
			await createResponseInDb(ticketId, MOCK_LEADER_ID)
			await createResponseInDb(ticketId, MOCK_OWNER_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(2)
		})

		it("Admin should get responses for admin ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_ADMIN_ID, null) // Admin ticket
			await createResponseInDb(ticketId, MOCK_ADMIN_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(1)
		})

		it("Admin should NOT get responses for company ticket", async () => {
			const ticketId = await createTicketInDb(MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID) // Company ticket
			await createResponseInDb(ticketId, MOCK_OWNER_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(404)
		})

		it("should return empty array for ticket with no responses", async () => {
			const ticketId = await createTicketInDb(MOCK_OWNER_ID, MOCK_COMPANY_ID)
			const response = await request(app).get(`/ticket/${ticketId}/responses`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(0)
		})
	})
})