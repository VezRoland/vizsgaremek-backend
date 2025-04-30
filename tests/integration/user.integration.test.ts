import {describe, it, expect, afterAll, beforeEach} from "vitest";
import request from "supertest";
import {Pool} from "pg";
import app from "../../index";
import {UserRole} from "../../types/database";
import path from "node:path";
import fs from "node:fs";
import {
	MOCK_OWNER_ID,
	MOCK_EMPLOYEE_ID,
	MOCK_COMPANY_ID,
	MOCK_LEADER_ID,
	TEST_LEADER_TOKEN,
	TEST_EMPLOYEE_TOKEN,
	TEST_OWNER_TOKEN
} from "../utility/testUtils";

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!;
if (!testDbConnectionString) {
	throw new Error("POSTGRES_URL environment variable is not set for tests.");
}
const pool = new Pool({connectionString: testDbConnectionString});

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`;
const LEADER_COOKIE = createAuthCookie(TEST_LEADER_TOKEN);
const EMPLOYEE_COOKIE = createAuthCookie(TEST_EMPLOYEE_TOKEN);
const OWNER_COOKIE = createAuthCookie(TEST_OWNER_TOKEN)

// --- Test File Paths ---
const dummyImagePath = path.resolve(__dirname, "../utility/testImage.png");
const dummyLargeImagePath = path.resolve(__dirname, "../utility/testLargeImage.png");
const dummyNonImagePath = path.resolve(__dirname, "../utility/testFile.txt");
const BUCKET_NAME = "avatars"

// --- Test Suite Setup/Teardown ---
beforeEach(async () => {
	try {
		await pool.query(`TRUNCATE public.schedule, public.ticket_response, public.ticket, public.submission, public.training_in_progress, public.training, public."user", public.company RESTART IDENTITY CASCADE`);

		await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
			[MOCK_COMPANY_ID, "User Test Company", "USERCODE"]);
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, avatar_url)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[MOCK_OWNER_ID, "Seed Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35, null]);
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, avatar_url)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[MOCK_LEADER_ID, "Seed Leader", UserRole.Leader, MOCK_COMPANY_ID, true, 30, 'http://example.com/storage/v1/object/public/avatars/leader-initial.png']);
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, avatar_url)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[MOCK_EMPLOYEE_ID, "Seed Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25, null]);

		// Create dummy files if they don't exist
		if (!fs.existsSync(dummyImagePath)) fs.writeFileSync(dummyImagePath, "dummy png data");
		if (!fs.existsSync(dummyLargeImagePath)) fs.writeFileSync(dummyLargeImagePath, Buffer.alloc(3 * 1024 * 1024)); // 3MB > 2MB
		if (!fs.existsSync(dummyNonImagePath)) fs.writeFileSync(dummyNonImagePath, "this is not an image");

	} catch (err) {
		console.error("Seeding failed in beforeEach (user tests):", err);
		throw err;
	}
});

afterAll(async () => {
	console.log("Closing test DB connection pool (user tests)...");
	await pool.end();
	console.log("Test DB pool closed (user tests).");
	// Clean up dummy files
	try {
		if (fs.existsSync(dummyImagePath)) fs.unlinkSync(dummyImagePath);
		if (fs.existsSync(dummyLargeImagePath)) fs.unlinkSync(dummyLargeImagePath);
		if (fs.existsSync(dummyNonImagePath)) fs.unlinkSync(dummyNonImagePath);
	} catch (err) {
		console.warn("Could not clean up dummy test files:", err);
	}
});

// --- Tests ---
describe("User API Integration Tests", () => {

	// =============================================
	// POST /user/avatar
	// =============================================
	describe("POST /user/avatar", () => {

		it("should 400 if no file is provided", async () => {
			const response = await request(app)
				.post("/user/avatar")
				.set("Cookie", EMPLOYEE_COOKIE);
			expect(response.status).toBe(400);
			expect(response.body.message).toContain("No avatar file provided");
		});

		it("should 200 for Employee uploading avatar for the first time", async () => {
			const response = await request(app)
				.post("/user/avatar")
				.set("Cookie", EMPLOYEE_COOKIE)
				.attach("avatar", dummyImagePath);

			expect(response.status).toBe(200);
			expect(response.body.status).toBe("success");
			expect(response.body.data?.avatarUrl).toContain(`/public/${BUCKET_NAME}/${MOCK_EMPLOYEE_ID}.png`);

			// Verify DB update (URL comes from mock)
			const dbCheck = await pool.query("SELECT avatar_url FROM public.\"user\" WHERE id = $1", [MOCK_EMPLOYEE_ID]);
			expect(dbCheck.rowCount).toBe(1);
			expect(dbCheck.rows[0].avatar_url).toContain(`/public/${BUCKET_NAME}/${MOCK_EMPLOYEE_ID}.png`);
		});

		it("should 200 for Leader updating existing avatar", async () => {
			const response = await request(app)
				.post("/user/avatar")
				.set("Cookie", LEADER_COOKIE)
				.attach("avatar", dummyImagePath);

			expect(response.status).toBe(200);
			expect(response.body.status).toBe("success");
			expect(response.body.data?.avatarUrl).toContain(`/public/${BUCKET_NAME}/${MOCK_LEADER_ID}.png`);

			const dbCheck = await pool.query("SELECT avatar_url FROM public.\"user\" WHERE id = $1", [MOCK_LEADER_ID]);
			expect(dbCheck.rowCount).toBe(1);
			expect(dbCheck.rows[0].avatar_url).toContain(`/public/${BUCKET_NAME}/${MOCK_LEADER_ID}.png`);
		});
	});

	// =============================================
	// PATCH /user/name
	// =============================================
	describe("PATCH /user/name", () => {
		const newNameData = {name: "Updated Name"}
		const invalidNameData = {name: ""} // Too short

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app)
				.patch("/user/name")
				.send(newNameData)
			expect(response.status).toBe(401)
		})

		it("should 400 for invalid name (too short)", async () => {
			const response = await request(app)
				.patch("/user/name")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(invalidNameData)
			expect(response.status).toBe(400)
			expect(response.body.errors?.fieldErrors).toHaveProperty("name")
		})

		it("should 200 for Employee updating their own name", async () => {
			const response = await request(app)
				.patch("/user/name")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(newNameData)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data?.name).toBe(newNameData.name)

			await pool.query(`UPDATE public."user" SET name = $1 WHERE id = $2`, [
				newNameData.name,
				MOCK_EMPLOYEE_ID
			])

			// Verify the name change in the public.user table
			const dbCheck = await pool.query("SELECT name FROM public.\"user\" WHERE id = $1", [MOCK_EMPLOYEE_ID])
			expect(dbCheck.rowCount).toBe(1)
			expect(dbCheck.rows[0].name).toBe(newNameData.name)
		})

		it("should 200 for Owner updating their own name", async () => {
			const ownerNewName = {name: "New Owner Name"}
			const response = await request(app)
				.patch("/user/name")
				.set("Cookie", OWNER_COOKIE)
				.send(ownerNewName)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data?.name).toBe(ownerNewName.name)

			await pool.query(`UPDATE public."user" SET name = $1 WHERE id = $2`, [
				ownerNewName.name,
				MOCK_OWNER_ID
			])

			const dbCheck = await pool.query("SELECT name FROM public.\"user\" WHERE id = $1", [MOCK_OWNER_ID])
			expect(dbCheck.rowCount).toBe(1)
			expect(dbCheck.rows[0].name).toBe(ownerNewName.name)
		})
	})

	// =============================================
	// PATCH /user/age
	// =============================================
	describe("PATCH /user/age", () => {
		const newAgeData = {age: 31}
		const invalidAgeDataLow = {age: 10}
		const invalidAgeDataHigh = {age: 150}

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app)
				.patch("/user/age")
				.send(newAgeData)
			expect(response.status).toBe(401)
		})

		it("should 400 for invalid age (too low)", async () => {
			const response = await request(app)
				.patch("/user/age")
				.set("Cookie", LEADER_COOKIE)
				.send(invalidAgeDataLow)
			expect(response.status).toBe(400)
			expect(response.body.errors?.fieldErrors).toHaveProperty("age")
		})

		it("should 400 for invalid age (too high)", async () => {
			const response = await request(app)
				.patch("/user/age")
				.set("Cookie", LEADER_COOKIE)
				.send(invalidAgeDataHigh)
			expect(response.status).toBe(400)
			expect(response.body.errors?.fieldErrors).toHaveProperty("age")
		})

		it("should 200 for Leader updating their own age", async () => {
			const response = await request(app)
				.patch("/user/age")
				.set("Cookie", LEADER_COOKIE)
				.send(newAgeData)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data?.age).toBe(newAgeData.age)

			// Verify the age change in the public.user table
			const dbCheck = await pool.query("SELECT age FROM public.\"user\" WHERE id = $1", [MOCK_LEADER_ID])
			expect(dbCheck.rowCount).toBe(1)
			expect(dbCheck.rows[0].age).toBe(newAgeData.age)
		})

		it("should 200 for Employee updating their own age", async () => {
			const employeeNewAge = {age: 26}
			const response = await request(app)
				.patch("/user/age")
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(employeeNewAge)

			expect(response.status).toBe(200)
			expect(response.body.status).toBe("success")
			expect(response.body.data?.age).toBe(employeeNewAge.age)

			const dbCheck = await pool.query("SELECT age FROM public.\"user\" WHERE id = $1", [MOCK_EMPLOYEE_ID])
			expect(dbCheck.rowCount).toBe(1)
			expect(dbCheck.rows[0].age).toBe(employeeNewAge.age)
		})
	})
});