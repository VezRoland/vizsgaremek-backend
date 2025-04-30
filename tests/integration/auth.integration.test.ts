import { describe, it, expect, afterAll, beforeEach } from "vitest"
import request from "supertest"
import { Pool } from "pg"
import app from "../../index"
import { UserRole } from "../../types/database"
import {
	MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID,
	MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN,
	MOCK_ACCESS_TOKEN_2, MOCK_REFRESH_TOKEN_2,
	MOCK_LOGIN_EMAIL, MOCK_LOGIN_PASSWORD
} from "../utility/testUtils"

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!
if (!testDbConnectionString) {
	throw new Error("POSTGRES_URL environment variable is not set for tests.")
}
const pool = new Pool({ connectionString: testDbConnectionString })

// --- Constants ---
const VALID_COMPANY_CODE = "AUTHCODE"

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

const getCookies = (response: request.Response): Record<string, string> => {
	const cookies: Record<string, string> = {}
	const setCookieHeaders = response.headers["set-cookie"]
	if (setCookieHeaders) {
		setCookieHeaders.forEach((cookieString: string) => {
			const parts = cookieString.split(";")[0].split("=")
			if (parts.length === 2) {
				cookies[parts[0].trim()] = parts[1].trim()
			}
		})
	}
	return cookies
}

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
		const validCredentials = { email: MOCK_LOGIN_EMAIL, password: MOCK_LOGIN_PASSWORD }

		beforeEach(async () => {
			await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                        VALUES ($1, $2, $3, $4, $5, $6)`,
				[MOCK_EMPLOYEE_ID, "Login User", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		})

		it("should successfully sign in and set auth + refresh cookies", async () => {
			const response = await request(app)
				.post("/auth/sign-in")
				.send(validCredentials)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			const cookiesHeader = response.headers["set-cookie"]
			expect(cookiesHeader).toBeInstanceOf(Array)
			expect(cookiesHeader!.length).toBeGreaterThanOrEqual(2)

			// Check auth cookie
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`auth=${MOCK_ACCESS_TOKEN};`))).toBe(true)
			expect(cookiesHeader!.find(cookie => cookie.startsWith(`auth=`))).toMatch(/Max-Age=[1-9][0-9]*/) // Check Max-Age is positive

			// Check refresh cookie
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`refresh=${MOCK_REFRESH_TOKEN};`))).toBe(true)
			expect(cookiesHeader!.find(cookie => cookie.startsWith(`refresh=`))).toContain("Max-Age=604800") // Check 7 day expiry
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
	// Token Refresh via Middleware Tests
	// =============================================
	describe("Token Refresh via Middleware", () => {
		beforeEach(async () => {
			await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                        VALUES ($1, $2, $3, $4, $5, $6)`,
				[MOCK_EMPLOYEE_ID, "Refresh Test User", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		})

		it("should succeed and set new cookies if only valid refresh token is provided", async () => {
			const response = await request(app)
				.get("/auth/user")
				.set("Cookie", [`refresh=${MOCK_REFRESH_TOKEN}`])

			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(MOCK_EMPLOYEE_ID)

			// Check NEW cookies are set
			const responseCookies = getCookies(response)
			expect(responseCookies["auth"]).toBe(MOCK_ACCESS_TOKEN_2)
			expect(responseCookies["refresh"]).toBe(MOCK_REFRESH_TOKEN_2)
		})

		it("should fail (401) if only an invalid refresh token is provided", async () => {
			const response = await request(app)
				.get("/auth/user")
				.set("Cookie", ["refresh=INVALID_REFRESH_TOKEN"])

			expect(response.status).toBe(401)

			const cookiesHeader = response.headers["set-cookie"]
			expect(cookiesHeader).toBeDefined()
			// Check refresh cookie IS cleared
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`refresh=;`) && cookie.includes("Expires="))).toBe(true)
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`auth=;`) && cookie.includes("Expires="))).toBe(true)
		})

		it("should fail (401) if no auth or refresh token is provided", async () => {
			const response = await request(app).get("/auth/user")
			expect(response.status).toBe(401)
		})

		it("should fail (401) if auth token is invalid and refresh token is missing", async () => {
			const response = await request(app)
				.get("/auth/user")
				.set("Cookie", ["auth=INVALID_ACCESS_TOKEN"]) // Only invalid auth token

			expect(response.status).toBe(401)
			const cookiesHeader = response.headers["set-cookie"]
			expect(cookiesHeader).toBeDefined()
			// Check auth cookie is cleared
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`auth=;`) && cookie.includes("Expires="))).toBe(true)
		})
	})

	// =============================================
	// POST /auth/sign-out
	// =============================================
	describe("POST /auth/sign-out", () => {
		it("should successfully sign out and clear BOTH cookies", async () => {
			const response = await request(app)
				.post("/auth/sign-out")
				.set("Cookie", [`auth=${MOCK_ACCESS_TOKEN}`, `refresh=${MOCK_REFRESH_TOKEN}`])

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")

			const cookiesHeader = response.headers["set-cookie"]
			expect(cookiesHeader).toBeDefined()
			expect(cookiesHeader!.length).toBeGreaterThanOrEqual(2)

			expect(cookiesHeader!.some(cookie => cookie.startsWith(`auth=;`) && cookie.includes("Expires="))).toBe(true)
			expect(cookiesHeader!.some(cookie => cookie.startsWith(`refresh=;`) && cookie.includes("Expires="))).toBe(true)
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
				.set("Cookie", [`auth=${MOCK_ACCESS_TOKEN}`])

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data).toBeDefined()
			expect(response.body.data.id).toBe(MOCK_EMPLOYEE_ID) // Check ID matches seeded user
			expect(response.body.data.name).toBe("Get User Test") // Check name matches seeded user
			expect(response.body.data.role).toBe(UserRole.Employee)
			expect(response.body.data.company_id).toBe(MOCK_COMPANY_ID)
			expect(response.body.data.age).toBe(28)
			expect(response.body.data.avatar_url).toBe("http://avatar.url/me.jpg")
			expect(response.headers["cache-control"]).toContain("private")
			expect(response.headers["cache-control"]).toContain("max-age=600")
		})

		it("should fail with 401 for unauthenticated user", async () => {
			const response = await request(app).get("/auth/user")
			expect(response.status).toBe(401) // Blocked by getUserFromCookie
		})
	})
})