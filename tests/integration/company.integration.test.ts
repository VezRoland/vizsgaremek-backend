import {describe, it, expect, afterAll, beforeEach} from "vitest";
import request from "supertest";
import {Pool} from "pg";
import app from "../../index";
import {UserRole} from "../../types/database";
import {
  MOCK_OWNER_ID,
  MOCK_LEADER_ID,
  MOCK_EMPLOYEE_ID,
  MOCK_ADMIN_ID,
  MOCK_COMPANY_ID,
  TEST_OWNER_TOKEN,
  TEST_LEADER_TOKEN,
  TEST_EMPLOYEE_TOKEN,
  TEST_ADMIN_TOKEN,
  MOCK_OTHER_COMPANY_ID,
  MOCK_SECOND_OWNER_ID,
  MOCK_UNVERIFIED_EMPLOYEE_ID,
  MOCK_OTHER_EMPLOYEE_ID
} from "../utility/testUtils";

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!;
if (!testDbConnectionString) {
  throw new Error("POSTGRES_URL environment variable is not set for tests.");
}
const pool = new Pool({connectionString: testDbConnectionString});

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`;
const OWNER_COOKIE = createAuthCookie(TEST_OWNER_TOKEN);
const LEADER_COOKIE = createAuthCookie(TEST_LEADER_TOKEN);
const EMPLOYEE_COOKIE = createAuthCookie(TEST_EMPLOYEE_TOKEN);
const ADMIN_COOKIE = createAuthCookie(TEST_ADMIN_TOKEN);

// --- Test Suite Setup/Teardown ---
const ORIGINAL_COMPANY_NAME = "Test Seed Company";

beforeEach(async () => {
  try {
    await pool.query(`TRUNCATE public.schedule, public.ticket_response, public.ticket, public.submission, public.training_in_progress, public.training, public."user", public.company RESTART IDENTITY CASCADE`);

    await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
      [MOCK_COMPANY_ID, ORIGINAL_COMPANY_NAME, "COMPCODE"]);
    await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
      [MOCK_OTHER_COMPANY_ID, "Other Test Company", "OTHERCDE"]);

    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_OWNER_ID, "Seed Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35, null]);
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_SECOND_OWNER_ID, "Second Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 40, null]); // Second owner in same company
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_LEADER_ID, "Seed Leader", UserRole.Leader, MOCK_COMPANY_ID, true, 30, null]);
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_EMPLOYEE_ID, "Seed Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25, 15]); // Employee with wage
    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_UNVERIFIED_EMPLOYEE_ID, "Unverified Employee", UserRole.Employee, MOCK_COMPANY_ID, false, 22, 14]); // Unverified user

    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_OTHER_EMPLOYEE_ID, "Other Employee", UserRole.Employee, MOCK_OTHER_COMPANY_ID, true, 28, 16]);

    await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age, hourly_wage)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [MOCK_ADMIN_ID, "Seed Admin", UserRole.Admin, null, true, 40, null]);

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
    const newNameData = {name: "MegaCorp Inc."};
    const invalidNameDataTooShort = {name: ""};
    const invalidNameDataTooLong = {name: "A".repeat(101)};


    it("should 401 for unauthenticated user", async () => {
      const response = await request(app)
        .patch("/company/name")
        .send(newNameData);
      expect(response.status).toBe(401);
    });

    it("should 403 for Employee", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", EMPLOYEE_COOKIE)
        .send({hourlyWage: 25});
      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Only Owners can update user data.");
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
        .get("/company/users")
        .set("Cookie", ADMIN_COOKIE);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Requesting user is not associated with a company.");
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

      const dbCheck = await pool.query("SELECT name FROM public.company WHERE id = $1", [MOCK_COMPANY_ID]);
      expect(dbCheck.rowCount).toBe(1);
      expect(dbCheck.rows[0].name).toBe(newNameData.name);
    });
  });

  // =============================================
  // GET /company/users
  // =============================================
  describe("GET /company/users", () => {

    it("should 401 for unauthenticated user", async () => {
      const response = await request(app).get("/company/users");
      expect(response.status).toBe(401);
    });

    it("should 403 for Employee", async () => {
      const response = await request(app)
        .get("/company/users")
        .set("Cookie", EMPLOYEE_COOKIE);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Employees do not have permission");
    });

    it("should 400 for Admin (not associated with a company)", async () => {
      const response = await request(app)
        .get("/company/users")
        .set("Cookie", ADMIN_COOKIE);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Requesting user is not associated with a company.");
    });

    it("Owner should get Leader, other Owner, and Employees (excluding self) in their company", async () => {
      const response = await request(app)
        .get("/company/users")
        .set("Cookie", OWNER_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      const userIds = response.body.data.map((u: any) => u.id);
      expect(userIds).toHaveLength(4);
      expect(userIds).toContain(MOCK_SECOND_OWNER_ID);
      expect(userIds).toContain(MOCK_LEADER_ID);
      expect(userIds).toContain(MOCK_EMPLOYEE_ID);
      expect(userIds).toContain(MOCK_UNVERIFIED_EMPLOYEE_ID);
      expect(userIds).not.toContain(MOCK_OWNER_ID); // Excludes self
      expect(userIds).not.toContain(MOCK_OTHER_EMPLOYEE_ID); // Excludes other company
      expect(response.body.data[0].role).toBe(UserRole.Owner);
      expect(response.body.data[1].role).toBe(UserRole.Leader);
      expect(response.body.data[2].role).toBe(UserRole.Employee);
      expect(response.body.data[3].role).toBe(UserRole.Employee);
    });

    it("Leader should get Employees (excluding self and Owners/other Leaders) in their company", async () => {
      const response = await request(app)
        .get("/company/users")
        .set("Cookie", LEADER_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      const userIds = response.body.data.map((u: any) => u.id);
      expect(userIds).toHaveLength(2);
      expect(userIds).toContain(MOCK_EMPLOYEE_ID);
      expect(userIds).toContain(MOCK_UNVERIFIED_EMPLOYEE_ID);
      expect(userIds).not.toContain(MOCK_LEADER_ID); // Excludes self
      expect(userIds).not.toContain(MOCK_OWNER_ID); // Excludes higher rank
      expect(userIds).not.toContain(MOCK_SECOND_OWNER_ID); // Excludes higher rank
    });
  });

  // =============================================
  // GET /company/user/:userId
  // =============================================
  describe("GET /company/user/:userId", () => {

    it("should 401 for unauthenticated user", async () => {
      const response = await request(app).get(`/company/user/${MOCK_EMPLOYEE_ID}`);
      expect(response.status).toBe(401);
    });

    it("should 403 for Admin", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", ADMIN_COOKIE);
      expect(response.status).toBe(403);
    });

    it("Employee should get 200 for own data", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", EMPLOYEE_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(MOCK_EMPLOYEE_ID);
      expect(response.body.data).toHaveProperty("name");
      expect(response.body.data).toHaveProperty("hourlyWage");
      expect(response.body.data).toHaveProperty("role");
      expect(Object.keys(response.body.data)).toHaveLength(4);
    });

    it("Employee should get 403 for other user's data", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", EMPLOYEE_COOKIE);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Employees can only view their own data.");
    });

    it("Leader should get 200 for self", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(MOCK_LEADER_ID);
    });

    it("Leader should get 200 for Employee in same company", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(MOCK_EMPLOYEE_ID);
      expect(response.body.data.role).toBe(UserRole.Employee);
    });

    it("Leader should get 403 for Owner in same company (higher rank)", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_OWNER_ID}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Cannot view users with a higher role.");
    });

    it("Leader should get 404 for user in different company", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_OTHER_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User not found");
    });

    it("Owner should get 200 for Leader in same company", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", OWNER_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(MOCK_LEADER_ID);
    });

    it("Owner should get 200 for other Owner in same company", async () => {
      const response = await request(app)
        .get(`/company/user/${MOCK_SECOND_OWNER_ID}`)
        .set("Cookie", OWNER_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(MOCK_SECOND_OWNER_ID);
      expect(response.body.data.role).toBe(UserRole.Owner);
    });

    it("should get 404 for non-existent user ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get(`/company/user/${nonExistentId}`)
        .set("Cookie", OWNER_COOKIE);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User not found");
    });
  });

  // =============================================
  // PATCH /company/verify/:userId
  // =============================================
  describe("PATCH /company/verify/:userId", () => {

    it("should 401 for unauthenticated user", async () => {
      const response = await request(app).patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`);
      expect(response.status).toBe(401);
    });

    it("should 403 for Employee", async () => {
      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", EMPLOYEE_COOKIE);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Only Leaders or Owners");
    });

    it("should 403 for Admin (not associated with a company)", async () => {
      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", ADMIN_COOKIE);
      expect(response.status).toBe(403);
    });

    it("Leader should successfully verify an unverified user in their company", async () => {
      let dbCheck = await pool.query("SELECT verified FROM public.\"user\" WHERE id = $1", [MOCK_UNVERIFIED_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].verified).toBe(false); // Pre-check

      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("verified successfully");

      dbCheck = await pool.query("SELECT verified FROM public.\"user\" WHERE id = $1", [MOCK_UNVERIFIED_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].verified).toBe(true); // Post-check
    });

    it("Owner should successfully verify an unverified user in their company", async () => {
      let dbCheck = await pool.query("SELECT verified FROM public.\"user\" WHERE id = $1", [MOCK_UNVERIFIED_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].verified).toBe(false); // Pre-check

      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("verified successfully");

      dbCheck = await pool.query("SELECT verified FROM public.\"user\" WHERE id = $1", [MOCK_UNVERIFIED_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].verified).toBe(true); // Post-check
    });

    it("should return 200 even if user is already verified", async () => {
      // First verify
      await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE);
      // Try verifying again
      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(200);
      expect(response.body.message).toContain("User is already verified.");
      // DB check (still true)
      const dbCheck = await pool.query("SELECT verified FROM public.\"user\" WHERE id = $1", [MOCK_UNVERIFIED_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].verified).toBe(true);
    });

    it("Leader should get 404 trying to verify user in another company", async () => {
      const response = await request(app)
        .patch(`/company/verify/${MOCK_OTHER_EMPLOYEE_ID}`) // User from OTHER company
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User to verify not found");
    });

    it("should get 404 for non-existent user ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .patch(`/company/verify/${nonExistentId}`)
        .set("Cookie", LEADER_COOKIE);
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User to verify not found");
    });
  });

  // =============================================
  // PATCH /company/user/:userId
  // =============================================
  describe("PATCH /company/user/:userId", () => {

    it("should 401 for unauthenticated user", async () => {
      const response = await request(app).patch(`/company/user/${MOCK_EMPLOYEE_ID}`).send({role: UserRole.Leader});
      expect(response.status).toBe(401);
    });

    it("should 403 for Employee", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", EMPLOYEE_COOKIE)
        .send({hourlyWage: 25});
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Only Owners can update user data");
    });

    it("should 403 for Leader", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", LEADER_COOKIE)
        .send({role: UserRole.Leader});
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Only Owners");
    });

    it("should 403 for Admin (not associated with a company)", async () => {
      const response = await request(app)
        .patch(`/company/verify/${MOCK_UNVERIFIED_EMPLOYEE_ID}`)
        .set("Cookie", ADMIN_COOKIE);
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Only Leaders or Owners can verify users.");
    });

    it("Owner should successfully update Employee role and wage", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({role: UserRole.Leader, hourlyWage: 20});

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("updated successfully");

      const dbCheck = await pool.query("SELECT role, hourly_wage FROM public.\"user\" WHERE id = $1", [MOCK_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].role).toBe(UserRole.Leader);
      expect(dbCheck.rows[0].hourly_wage).toBe(20);
    });

    it("Owner should successfully update Employee role (wage should become null)", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({role: UserRole.Leader});

      expect(response.status).toBe(200);

      const dbCheck = await pool.query("SELECT role FROM public.\"user\" WHERE id = $1", [MOCK_EMPLOYEE_ID]);
      expect(dbCheck.rows[0].role).toBe(UserRole.Leader);
    });

    it("Owner should successfully update Leader wage (role unchanged)", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_LEADER_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({hourlyWage: 30});

      expect(response.status).toBe(200);

      const dbCheck = await pool.query("SELECT role, hourly_wage FROM public.\"user\" WHERE id = $1", [MOCK_LEADER_ID]);
      expect(dbCheck.rows[0].role).toBe(UserRole.Leader); // Role unchanged
      expect(dbCheck.rows[0].hourly_wage).toBe(30);
    });


    it("Owner should get 403 trying to update self", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_OWNER_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({hourlyWage: 100});
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Cannot update your own");
    });

    it("Owner should get 403 trying to update another Owner", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_SECOND_OWNER_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({hourlyWage: 100}); // Trying to update the other owner
      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Cannot update data for other Owners");
    });

    it("Owner should get 404 trying to update user in another company", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_OTHER_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({role: UserRole.Leader});
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User to update not found");
    });

    it("should get 404 for non-existent user ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .patch(`/company/user/${nonExistentId}`)
        .set("Cookie", OWNER_COOKIE)
        .send({role: UserRole.Leader});
      expect(response.status).toBe(404);
      expect(response.body.message).toContain("User to update not found");
    });

    it("should get 400 for invalid request body (missing both fields)", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({}); // Empty body
      expect(response.status).toBe(400);
      expect(response.body.errors?.formErrors?.[0]).toContain("At least role or hourlyWage must be provided");
    });

    it("should get 400 for invalid request body (negative wage)", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({hourlyWage: -5});
      expect(response.status).toBe(400);
      expect(response.body.errors?.fieldErrors).toHaveProperty("hourlyWage");
    });

    it("should get 400 for invalid request body (invalid role number)", async () => {
      const response = await request(app)
        .patch(`/company/user/${MOCK_EMPLOYEE_ID}`)
        .set("Cookie", OWNER_COOKIE)
        .send({role: 99});
      expect(response.status).toBe(400);
      expect(response.body.errors?.fieldErrors).toHaveProperty("role");
    });
  });
});