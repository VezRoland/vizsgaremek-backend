// // Use bun:test imports for test structure
// import { describe, it, expect, beforeEach, afterEach } from "bun:test";
// // ^^^ IMPORTANT: Keep 'vi' import here for accessing the mock object later
//
// import request from "supertest";
// import express, { type Request, type Response, type NextFunction } from "express";
//
// // --- Mocking Dependencies using vi.mock ---
// // Mock postgres BEFORE it's imported by schedule.ts or the test file itself
// vi.mock('../../backend/lib/postgres', () => ({
// 	// Mock the default export
// 	default: {
// 		query: vi.fn(), // Create a mock function for query
// 	},
// }));
//
// // Mock utils BEFORE they are imported
// vi.mock('../../backend/lib/utils', () => ({
// 	// Mock the named export
// 	getUserFromCookie: vi.fn(), // Create a mock function
// }));
//
// // --- Now import the modules AFTER mocks are declared ---
// // Import the router AFTER the mocks have been set up by vi.mock
// import scheduleRouter from "../../backend/routes/schedule";
// // Import the mocked functions to access the mock object (.mock property)
// import { getUserFromCookie } from "../../backend/lib/utils";
// import postgres from "../../backend/lib/postgres";
//
// import { UserRole } from "../../backend/types/database";
// import type { User } from "@supabase/supabase-js";
//
// // Helper to create mock user (same as before)
// const createMockUser = (role: UserRole, userId: string, companyId: string | null): User => ({
// 	id: userId,
// 	app_metadata: {},
// 	user_metadata: {
// 		role: role,
// 		company_id: companyId,
// 		name: 'Test User',
// 		verified: true,
// 		created_at: new Date().toISOString(),
// 		age: 25,
// 	},
// 	aud: 'authenticated',
// 	created_at: new Date().toISOString(),
// });
//
// // --- Test Setup ---
// const app = express();
// app.use(express.json());
// app.use("/schedule", scheduleRouter); // Mount the router that now uses mocked imports
//
// beforeEach(() => {
// 	// Reset mocks before each test using vi methods
// 	vi.clearAllMocks(); // or vi.resetAllMocks() if you want to reset implementations too
//
// 	// Reset default mock implementations on the imported mock functions
// 	// Need to cast to access Vitest/Jest mock properties if TS doesn't infer it
// 	(getUserFromCookie as ReturnType<typeof vi.fn>).mockImplementation((req: Request, res: Response, next: NextFunction) => {
// 		(req as any).user = createMockUser(UserRole.Owner, "owner-uuid", "company-uuid");
// 		next();
// 	});
// 	(postgres.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], rowCount: 0 });
// });
//
// // --- Tests ---
//
// describe("Schedule API Routes (using vi.mock)", () => {
// 	describe("GET /schedule", () => {
// 		it("should return schedules for the current week by default for Owner", async () => {
// 			const mockSchedules = [
// 				{ id: 'sched-1', start: new Date().toISOString(), end: new Date().toISOString(), user_id: 'owner-uuid', company_id: 'company-uuid', name: 'Test User', avatar_url: null, category: 1 },
// 			];
// 			// Use mockResolvedValueOnce with cast if necessary
// 			(postgres.query as ReturnType<typeof vi.fn>)
// 				.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 }) // hasPrevSchedules check
// 				.mockResolvedValueOnce({ rows: mockSchedules, rowCount: 1 }); // fetchSchedulesForWeek
//
// 			const response = await request(app).get("/schedule");
//
// 			expect(response.status).toBe(200);
// 			expect(response.body.status).toBe("ignore");
// 			// Check calls using the imported mock function reference
// 			expect(postgres.query).toHaveBeenCalledTimes(2);
// 		});
//
// 		it("should return schedules for a specific week provided via query param", async () => {
// 			const specificWeekStart = "2025-04-01";
// 			const expectedStartOfWeek = "2025-03-31";
//
// 			(postgres.query as ReturnType<typeof vi.fn>)
// 				.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 })
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 });
//
// 			const response = await request(app).get(`/schedule?weekStart=${specificWeekStart}`);
//
// 			expect(response.status).toBe(200);
// 			expect(response.body.data.weekStart).toBe(expectedStartOfWeek);
// 			// Access mock calls via .mock property (requires cast)
// 			const queryArgs = (postgres.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as string[];
// 			expect(queryArgs[0]).toContain(new Date(expectedStartOfWeek + 'T23:59:59.999Z').toISOString());
// 			expect(queryArgs[1]).toContain(new Date(expectedStartOfWeek + 'T00:00:00.000Z').toISOString());
// 		});
//
// 		it("should correctly filter results for Employee role", async () => {
// 			(getUserFromCookie as ReturnType<typeof vi.fn>).mockImplementation((req: Request, res: Response, next: NextFunction) => {
// 				(req as any).user = createMockUser(UserRole.Employee, "employee-uuid", "company-uuid");
// 				next();
// 			});
// 			(postgres.query as ReturnType<typeof vi.fn>)
// 				.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 })
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 });
//
// 			await request(app).get("/schedule");
//
// 			const fetchQuery = (postgres.query as ReturnType<typeof vi.fn>).mock.calls[1][0];
// 			const fetchParams = (postgres.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as string[];
//
// 			expect(fetchQuery).toContain("s.user_id = $");
// 			expect(fetchParams).toContain("employee-uuid");
// 		});
//
// 		// ... other GET /schedule tests ...
// 	});
//
// 	describe("POST /schedule", () => {
// 		const validScheduleData = { /* ... */ };
//
// 		it("should create schedules successfully for valid data and permissions", async () => {
// 			(postgres.query as ReturnType<typeof vi.fn>)
// 				// Define sequence for all DB calls
// 				.mockResolvedValueOnce({ rows: [{ age: 25 }], rowCount: 1 }) // User 1 age
// 				.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 }) // User 1 overlap
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // User 1 adjacent
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // User 1 INSERT
// 				.mockResolvedValueOnce({ rows: [{ age: 25 }], rowCount: 1 }) // User 2 age
// 				.mockResolvedValueOnce({ rows: [{ exists: false }], rowCount: 1 }) // User 2 overlap
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 }) // User 2 adjacent
// 				.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // User 2 INSERT
//
// 			const response = await request(app).post("/schedule").send(validScheduleData);
//
// 			expect(response.status).toBe(201);
// 			expect(postgres.query).toHaveBeenCalledTimes(8);
// 			// Check specific calls if needed by accessing .mock.calls
// 		});
//
// 		// ... other POST /schedule tests ...
// 	});
//
// 	describe("DELETE /schedule", () => {
// 		const scheduleIdsToDelete = ["sched-to-delete-1", "sched-to-delete-2"];
//
// 		it("should delete schedules successfully when user has permission", async () => {
// 			(postgres.query as ReturnType<typeof vi.fn>)
// 				.mockResolvedValueOnce({ rows: [ /* schedules */ ], rowCount: 2 }) // Fetch
// 				.mockResolvedValueOnce({ rows: [], rowCount: 2 }); // Delete success
//
// 			const response = await request(app).delete("/schedule").send({ scheduleIds: scheduleIdsToDelete });
//
// 			expect(response.status).toBe(200);
// 			expect(postgres.query).toHaveBeenCalledTimes(2);
// 			expect((postgres.query as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain("DELETE");
// 		});
//
// 		// ... other DELETE /schedule tests ...
// 	});
//
// 	// ... other describe blocks ...
// });