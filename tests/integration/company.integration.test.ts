// tests/integration/company.integration.test.ts
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { Pool } from "pg";
import app from "../../index"; // Your Express app instance
import { UserRole } from "../../types/database";
import {
  MOCK_OWNER_ID,
  MOCK_LEADER_ID,
  MOCK_EMPLOYEE_ID,
  MOCK_ADMIN_ID,
  MOCK_COMPANY_ID,
  TEST_OWNER_TOKEN, // Assuming you have these defined in testUtils
  TEST_LEADER_TOKEN,
  TEST_EMPLOYEE_TOKEN,
  TEST_ADMIN_TOKEN
} from "../utility/testUtils";

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!;
if (!testDbConnectionString) {
  throw new Error("POSTGRES_URL environment variable is not set for tests.");
}
const pool = new Pool({ connectionString: testDbConnectionString });

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`;
const OWNER_COOKIE = createAuthCookie(TEST_OWNER_TOKEN);
const LEADER_COOKIE = createAuthCookie(TEST_LEADER_TOKEN);
const EMPLOYEE_COOKIE = createAuthCookie(TEST_EMPLOYEE_TOKEN);
const ADMIN_COOKIE = createAuthCookie(TEST_ADMIN_TOKEN); // Admin user mock should have company_id: null

// --- Test Suite Setup/Teardown ---
const ORIGINAL_COMPANY_NAME = "Test Seed Company";

beforeEach(async () => {
  // Clean tables before each test
  try {
    await pool.query(`TRUNCATE public.schedule, public.ticket_response, public.ticket, public.submission, public.training_in_progress, public.training, public."user", public.company RESTART IDENTITY CASCADE`);

    // Seed company and users
    await pool.query(`INSERT INTO public.company (id, name, code) VALUES ($1, $2, $3)`,
      [MOCK_COMPANY_ID, ORIGINAL_COMPANY_NAME, "COMPCODE"]);
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age) VALUES ($1, $2, $3, $4, $5, $6)`,
      [MOCK_OWNER_ID, "Seed Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35]);
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age) VALUES ($1, $2, $3, $4, $5, $6)`,
      [MOCK_LEADER_ID, "Seed Leader", UserRole.Leader, MOCK_COMPANY_ID, true, 30]);
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age) VALUES ($1, $2, $3, $4, $5, $6)`,
      [MOCK_EMPLOYEE_ID, "Seed Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25]);
    // Ensure the Admin user mock used by setup.ts has company_id null
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age) VALUES ($1, $2, $3, $4, $5, $6)`,
      [MOCK_ADMIN_ID, "Seed Admin", UserRole.Admin, null, true, 40]);

  } catch (err) {
    console.error("Seeding failed in beforeEach (company tests):", err);
    throw err;
  }
});

afterAll(async () => {
  console.log("Closing test DB connection pool (company tests)...");
  await pool.end();
  console.log("Test DB pool closed (company tests).");
});

// --- Tests ---
describe("Company API Integration Tests", () => {

  // =============================================
  // PATCH /company/name
  // =============================================
  describe("PATCH /company/name", () => {
    const newNameData = { name: "MegaCorp Inc." };
    const invalidNameDataTooShort = { name: "" };
    const invalidNameDataTooLong = { name: "A".repeat(101) };


    it("should 401 for unauthenticated user", async () => {
      const response = await request(app)
        .patch("/company/name")
        .send(newNameData);
      expect(response.status).toBe(401);
    });

    it("should 403 for Employee", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", EMPLOYEE_COOKIE)
        .send(newNameData);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("permission");
    });

    it("should 403 for Leader", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", LEADER_COOKIE)
        .send(newNameData);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("permission");
    });

    it("should 400 for Admin (not associated with a company)", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", ADMIN_COOKIE) // Admin mock has null company_id
        .send(newNameData);
      expect(response.status).toBe(400); // Or 403 depending on exact check order
      expect(response.body.message).toContain("User is not associated with a company");
    });

    it("should 400 for invalid name (too short)", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", OWNER_COOKIE)
        .send(invalidNameDataTooShort);
      expect(response.status).toBe(400);
      expect(response.body.errors?.fieldErrors).toHaveProperty("name");
    });

    it("should 400 for invalid name (too long)", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", OWNER_COOKIE)
        .send(invalidNameDataTooLong);
      expect(response.status).toBe(400);
      expect(response.body.errors?.fieldErrors).toHaveProperty("name");
    });

    it("should 200 for Owner and update the company name", async () => {
      const response = await request(app)
        .patch("/company/name")
        .set("Cookie", OWNER_COOKIE)
        .send(newNameData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("updated successfully");

      // Verify in DB
      const dbCheck = await pool.query("SELECT name FROM public.company WHERE id = $1", [MOCK_COMPANY_ID]);
      expect(dbCheck.rowCount).toBe(1);
      expect(dbCheck.rows[0].name).toBe(newNameData.name);
    });
  });
});