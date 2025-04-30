import { describe, it, expect, afterAll, beforeEach } from "vitest"
import request from "supertest"
import { Pool } from "pg"
import app from "../../index"
import { UserRole } from "../../types/database"
import {
	MOCK_EMPLOYEE_ID,
	MOCK_COMPANY_ID,
	MOCK_ACCESS_TOKEN
} from "../utility/testUtils"

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!
if (!testDbConnectionString) {
	throw new Error("POSTGRES_URL environment variable is not set for tests.")
}
const pool = new Pool({ connectionString: testDbConnectionString })

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`
const LOGGED_IN_EMPLOYEE_COOKIE = createAuthCookie("TEST_EMPLOYEE_TOKEN")

// --- Constants ---
const VALID_COMPANY_CODE = "AUTHCODE" // Use a predictable code

// --- Test Suite Setup/Teardown ---
beforeEach(async () => {
	try {
		await pool.query(`TRUNCATE public."user", public.company RESTART IDENTITY CASCADE`)

		await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
			[MOCK_COMPANY_ID, "Auth Test Company", VALID_COMPANY_CODE])

	} catch (err) {
		console.error("Seeding failed in beforeEach (auth tests):", err)
		throw err
	}
})

afterAll(async () => {
	console.log("Closing test DB connection pool (auth tests)...")
	await pool.end()
	console.log("Test DB pool closed (auth tests).")
})

// --- Tests ---
describe("Auth API Integration Tests", () => {

	// =============================================
	// POST /auth/sign-up/company
	// =============================================
	describe("POST /auth/sign-up/company", () => {
		const validCompanyData = {
			name: "New User",
			email: "newcompany@test.com",
			password: "password123",
			company_name: "New Awesome Company"
		}

		it("should successfully sign up a new company and owner", async () => {
			const response = await request(app)
				.post("/auth/sign-up/company")
				.send(validCompanyData)

			expect(response.status).toBe(201)
			expect(response.body.status).toBe("success")
			expect(response.body.message).toContain("Signed up successfully")

			const companyRes = await pool.query("SELECT name, code FROM public.company WHERE name = $1", [validCompanyData.company_name])
			expect(companyRes.rowCount).toBe(1)
			expect(companyRes.rows[0].name).toBe(validCompanyData.company_name)
			expect(companyRes.rows[0].code).toHaveLength(8)
		})

		it("should fail with 422 for invalid input data", async () => {
			const response = await request(app)
				.post("/auth/sign-up/company")
				.send({ email: "invalid", password: "short", name: "N", company_name: "" }) // Invalid data

			expect(response.status).toBe(422)
			expect(response.body.status).toBe("error")
			expect(response.body.errors?.fieldErrors).toHaveProperty("email")
			expect(response.body.errors?.fieldErrors).toHaveProperty("password")
			expect(response.body.errors?.fieldErrors).toHaveProperty("company_name")
		})

		it("should fail if email already exists", async () => {
			const response = await request(app)
				.post("/auth/sign-up/company")
				.send({ ...validCompanyData, email: "exists@test.com" })

			expect(response.status).toBe(422) // Match Supabase error code mapping
			expect(response.body.status).toBe("error")
			expect(response.body.errors?.email).toContain("Email is already in use")
		})
	})

	// =============================================
	// POST /auth/sign-up/employee
	// =============================================
	describe("POST /auth/sign-up/employee", () => {
		const validEmployeeData = {
			name: "New Employee",
			email: "newemployee@test.com",
			password: "password123",
			company_code: VALID_COMPANY_CODE
		}

		it("should successfully sign up a new employee", async () => {
			const response = await request(app)
				.post("/auth/sign-up/employee")
				.send(validEmployeeData)

			expect(response.status).toBe(201)
			expect(response.body.status).toBe("success")
		})

		it("should fail with 422 for invalid input data", async () => {
			const response = await request(app)
				.post("/auth/sign-up/employee")
				.send({ email: "invalid", password: "short", name: "", company_code: "123" }) // Invalid data
			expect(response.status).toBe(422)
			expect(response.body.errors?.fieldErrors).toHaveProperty("email")
			expect(response.body.errors?.fieldErrors).toHaveProperty("password")
			expect(response.body.errors?.fieldErrors).toHaveProperty("company_code")
		})

		it("should fail if email already exists", async () => {
			const response = await request(app)
				.post("/auth/sign-up/employee")
				.send({ ...validEmployeeData, email: "exists@test.com" }) // Use email mock rejects
			expect(response.status).toBe(422)
			expect(response.body.errors?.email).toContain("Email is already in use")
		})

		it("should fail with 404 for invalid company code", async () => {
			const response = await request(app)
				.post("/auth/sign-up/employee")
				.send({ ...validEmployeeData, company_code: "INVALIDC" }) // Invalid code
			expect(response.status).toBe(404)
			expect(response.body.errors?.company_code).toContain("Invalid company code")
		})
	})

	// =============================================
	// POST /auth/sign-in
	// =============================================
	describe("POST /auth/sign-in", () => {
		const validCredentials = { email: "employee@test.com", password: "password123" } // Matches mock success case

		beforeEach(async () => {
			await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                        VALUES ($1, $2, $3, $4, $5, $6)`,
				[MOCK_EMPLOYEE_ID, "Login User", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		})

		it("should successfully sign in with valid credentials", async () => {
			const response = await request(app)
				.post("/auth/sign-in")
				.send(validCredentials)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			// Check if the 'auth' cookie was set in the response
			const cookies = response.headers["set-cookie"]
			expect(cookies).toBeDefined()
			expect(cookies![0]).toContain(`auth=${MOCK_ACCESS_TOKEN}`) // Check name and mock token value
			expect(cookies![0]).toContain("HttpOnly")
			expect(cookies![0]).toContain("Secure")
			expect(cookies![0]).toContain("SameSite=None")
		})

		it("should fail with 400/401 for invalid password", async () => {
			const response = await request(app)
				.post("/auth/sign-in")
				.send({ ...validCredentials, password: "wrongpassword" })

			expect(response.status).toBe(400) // Mock returns 400 for invalid_credentials
			expect(response.body.status).toBe("error")
			expect(response.body.errors?.email).toContain("Invalid credentials")
			expect(response.body.errors?.password).toContain("Invalid credentials")
		})

		it("should fail with 400/401 for non-existent email", async () => {
			const response = await request(app)
				.post("/auth/sign-in")
				.send({ email: "nosuchuser@test.com", password: "password123" })
			expect(response.status).toBe(400) // Mock returns 400
			expect(response.body.status).toBe("error")
			expect(response.body.errors?.email).toContain("Invalid credentials")
		})

		it("should fail with 422 for invalid input format", async () => {
			const response = await request(app)
				.post("/auth/sign-in")
				.send({ email: "not-an-email", password: "" })
			expect(response.status).toBe(422)
			expect(response.body.errors?.fieldErrors).toHaveProperty("email")
			expect(response.body.errors?.fieldErrors).toHaveProperty("password")
		})
	})

	// =============================================
	// POST /auth/sign-out
	// =============================================
	describe("POST /auth/sign-out", () => {
		it("should successfully sign out an authenticated user", async () => {
			const response = await request(app)
				.post("/auth/sign-out")
				.set("Cookie", LOGGED_IN_EMPLOYEE_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			// Check that the cookie is cleared
			const cookies = response.headers["set-cookie"]
			expect(cookies).toBeDefined()
			expect(cookies![0]).toContain("auth=;") // Check for empty value
			expect(cookies![0]).toContain("Expires=")
		})

		it("should fail with 401 for unauthenticated user", async () => {
			const response = await request(app).post("/auth/sign-out")
			expect(response.status).toBe(401) // Blocked by getUserFromCookie
		})
	})

	// =============================================
	// GET /auth/user
	// =============================================
	describe("GET /auth/user", () => {
		beforeEach(async () => {
			await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, avatar_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[MOCK_EMPLOYEE_ID, "Get User Test", UserRole.Employee, MOCK_COMPANY_ID, true, 28, "http://avatar.url/me.jpg"])
		})

		it("should return user data for an authenticated user", async () => {
			const response = await request(app)
				.get("/auth/user")
				.set("Cookie", LOGGED_IN_EMPLOYEE_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data).toBeDefined()
			expect(response.body.data.id).toBe(MOCK_EMPLOYEE_ID) // Check ID matches seeded user
			expect(response.body.data.name).toBe("Get User Test") // Check name matches seeded user
			expect(response.body.data.role).toBe(UserRole.Employee)
			expect(response.body.data.company_id).toBe(MOCK_COMPANY_ID)
			expect(response.body.data.age).toBe(28)
			expect(response.body.data.avatar_url).toBe("http://avatar.url/me.jpg")
			// Check Cache-Control header
			expect(response.headers["cache-control"]).toContain("private")
			expect(response.headers["cache-control"]).toContain("max-age=600")
		})

		it("should fail with 401 for unauthenticated user", async () => {
			const response = await request(app).get("/auth/user")
			expect(response.status).toBe(401) // Blocked by getUserFromCookie
		})
	})
})