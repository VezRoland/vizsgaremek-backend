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
	MOCK_UNDER18_EMPLOYEE_ID,
	MOCK_COMPANY_ID
} from "../utility/testUtils"
import fs from "node:fs"
import path from "node:path"

const dummyFilePath = path.resolve(__dirname, "../utility/testFile.pdf")

// --- Test Database Connection ---
const testDbConnectionString = process.env.POSTGRES_URL!
if (!testDbConnectionString) {
	throw new Error("POSTGRES_URL environment variable is not set for tests.")
}
const pool = new Pool({connectionString: testDbConnectionString})

// --- Mock Auth Cookies ---
const createAuthCookie = (token: string): string => `auth=${token}`
const OWNER_COOKIE = createAuthCookie("TEST_OWNER_TOKEN")
const LEADER_COOKIE = createAuthCookie("TEST_LEADER_TOKEN")
const EMPLOYEE_COOKIE = createAuthCookie("TEST_EMPLOYEE_TOKEN")
const ADMIN_COOKIE = createAuthCookie("TEST_ADMIN_TOKEN")

// --- Mock Training Data ---
const mockQuestions = [
	{
		id: crypto.randomUUID(),
		name: "Question 1?",
		answers: [{text: "A", correct: true}, {text: "B", correct: false}],
		multipleCorrect: false
	},
	{
		id: crypto.randomUUID(),
		name: "Question 2?",
		answers: [{text: "C", correct: false}, {text: "D", correct: true}],
		multipleCorrect: false
	}
]

const mockSubmissionAnswers = (questions: typeof mockQuestions) => {
	return questions.map(q => ({
		id: q.id,
		answers: [q.answers[0].text]
	}))
}


// --- Test Suite Setup/Teardown ---

beforeEach(async () => {
	try {
		await pool.query(`TRUNCATE
            public.submission, public.training_in_progress, public.training,
            public."user", public.company
        RESTART IDENTITY CASCADE`)

		await pool.query(`INSERT INTO public.company (id, name, code)
                      VALUES ($1, $2, $3)`,
			[MOCK_COMPANY_ID, "Test Seed Company", "SEEDCODE"])

		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_OWNER_ID, "Test Owner", UserRole.Owner, MOCK_COMPANY_ID, true, 35])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_LEADER_ID, "Test Leader", UserRole.Leader, MOCK_COMPANY_ID, true, 30])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_EMPLOYEE_ID, "Test Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 25])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_UNDER18_EMPLOYEE_ID, "Test Young Employee", UserRole.Employee, MOCK_COMPANY_ID, true, 17])
		await pool.query(`INSERT INTO public."user" (id, name, role, company_id, verified, age)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
			[MOCK_ADMIN_ID, "Test Admin", UserRole.Admin, null, true, 40])
	} catch (err) {
		console.error("Seeding failed in beforeEach:", err)
		throw err
	}
})

afterAll(async () => {
	console.log("Closing test DB connection pool...")
	await pool.end()
	console.log("Test DB pool closed.")
})

// --- Helper Functions ---
const createTrainingInDb = async (
	name: string,
	description: string,
	role: UserRole,
	companyId: string | null = MOCK_COMPANY_ID,
	questions: any = mockQuestions,
	fileUrl: string
): Promise<string> => {
	const res = await pool.query(
		`INSERT INTO training (name, description, role, questions, file_url, company_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     RETURNING id`,
		[name, description, role, JSON.stringify(questions), fileUrl, companyId]
	)
	return res.rows[0].id
}

const startTrainingForUser = async (userId: string, trainingId: string) => {
	await pool.query(
		"INSERT INTO training_in_progress (user_id, training_id) VALUES ($1, $2)",
		[userId, trainingId]
	)
}

const createSubmissionInDb = async (
	userId: string,
	trainingId: string,
	companyId: string | null = MOCK_COMPANY_ID,
	answers: any = mockSubmissionAnswers(mockQuestions)
): Promise<string> => {
	const res = await pool.query(
		`INSERT INTO submission (user_id, company_id, training_id, answers)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
		[userId, companyId, trainingId, JSON.stringify(answers)]
	)
	return res.rows[0].id
}


// --- Tests ---
describe("Training API Integration Tests", () => {

	// =============================================
	// GET /training/
	// =============================================
	describe("GET /training/", () => {
		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).get("/training/")
			expect(response.status).toBe(401)
		})

		it("Employee should get only Employee-role trainings for their company", async () => {
			const empTrainingId = await createTrainingInDb("Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			const leaderTrainingId = await createTrainingInDb("Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			await startTrainingForUser(MOCK_EMPLOYEE_ID, empTrainingId) // Mark one as active
			await createSubmissionInDb(MOCK_EMPLOYEE_ID, leaderTrainingId) // Mark one as completed (even if wrong role, for test)

			const response = await request(app).get("/training/").set("Cookie", EMPLOYEE_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(1) // Should only see Employee training
			expect(response.body.data[0].id).toBe(empTrainingId)
			expect(response.body.data[0].name).toBe("Emp Training")
			expect(response.body.data[0].active).toBe(true) // Because we started it
			expect(response.body.data[0].completed).toBe(false) // Not submitted for this one
		})

		it("Owner/Leader should get all trainings for their company", async () => {
			const empTrainingId = await createTrainingInDb("Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			const leaderTrainingId = await createTrainingInDb("Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			await startTrainingForUser(MOCK_OWNER_ID, leaderTrainingId) // Owner started Leader training
			await createSubmissionInDb(MOCK_OWNER_ID, empTrainingId) // Owner completed Employee training

			const response = await request(app).get("/training/").set("Cookie", OWNER_COOKIE)

			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(2)
			const empTraining = response.body.data.find((t: any) => t.id === empTrainingId)
			const leaderTraining = response.body.data.find((t: any) => t.id === leaderTrainingId)
			expect(empTraining.completed).toBe(true)
			expect(empTraining.active).toBe(false)
			expect(leaderTraining.completed).toBe(false)
			expect(leaderTraining.active).toBe(true)
		})

		it("should 403 for Admin", async () => {
			await createTrainingInDb("Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			const response = await request(app).get("/training/").set("Cookie", ADMIN_COOKIE)
			expect(response.status).toBe(403) // Admins cannot view company trainings
		})
	})

	// =============================================
	// GET /training/results
	// =============================================
	describe("GET /training/results", () => {
		let empTrainingId: string
		let leaderTrainingId: string
		let empSubmissionId: string
		let leaderSubmissionId: string

		beforeEach(async () => {
			empTrainingId = await createTrainingInDb("Results Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			leaderTrainingId = await createTrainingInDb("Results Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			empSubmissionId = await createSubmissionInDb(MOCK_EMPLOYEE_ID, empTrainingId) // Employee submits Employee training
			leaderSubmissionId = await createSubmissionInDb(MOCK_LEADER_ID, leaderTrainingId) // Leader submits Leader training
		})

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).get("/training/results")
			expect(response.status).toBe(401)
		})

		it("should 403 for Employee (accessing general results)", async () => {
			const response = await request(app).get("/training/results").set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(403)
		})

		it("Owner/Leader should get recent company results (without testId)", async () => {
			const response = await request(app).get("/training/results").set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(2) // Both submissions
			expect(response.body.data[0]).not.toHaveProperty("questionEvaluations")
			expect(response.body.data[0]).toHaveProperty("userName")
			expect(response.body.data[0]).toHaveProperty("trainingName")
			expect(response.body.data[0]).toHaveProperty("correctCount")
		})

		it("Employee should get OWN detailed result using ?testId", async () => {
			const response = await request(app).get(`/training/results?testId=${empTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(1)
			expect(response.body.data[0].id).toBe(empSubmissionId)
			expect(response.body.data[0].userName).toBe("Test Employee")
			expect(response.body.data[0]).toHaveProperty("questionEvaluations")
			expect(response.body.data[0].questionEvaluations.length).toBe(mockQuestions.length)
		})

		it("Employee should NOT get another user's detailed result using ?testId", async () => {
			const response = await request(app).get(`/training/results?testId=${leaderTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(0) // No results for this employee for that training
		})

		it("Owner/Leader should get detailed results for specific testId", async () => {
			await createSubmissionInDb(MOCK_EMPLOYEE_ID, leaderTrainingId)

			const response = await request(app).get(`/training/results?testId=${leaderTrainingId}`).set("Cookie", LEADER_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data).toBeInstanceOf(Array)
			expect(response.body.data.length).toBe(2) // Leader's and Employee's submission for this training
			expect(response.body.data[0]).toHaveProperty("questionEvaluations")
			expect(response.body.data[1]).toHaveProperty("questionEvaluations")
		})
	})

	// =============================================
	// GET /training/test/:testId
	// =============================================
	describe("GET /training/test/:testId", () => {
		let empTrainingId: string
		let leaderTrainingId: string

		beforeEach(async () => {
			empTrainingId = await createTrainingInDb("Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			leaderTrainingId = await createTrainingInDb("Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
		})

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).get(`/training/test/${empTrainingId}`)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent testId", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app).get(`/training/test/${nonExistentId}`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Employee should get inactive Employee-role training (no questions)", async () => {
			const response = await request(app).get(`/training/test/${empTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(empTrainingId)
			expect(response.body.data.isActive).toBe(false)
			expect(response.body.data).not.toHaveProperty("questions")
			expect(response.body.data.fileUrl).toContain("http://urlmockurl.com/signed")
		})

		it("Employee should get active Employee-role training (with questions)", async () => {
			await startTrainingForUser(MOCK_EMPLOYEE_ID, empTrainingId) // Mark as active
			const response = await request(app).get(`/training/test/${empTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(empTrainingId)
			expect(response.body.data.isActive).toBe(true)
			expect(response.body.data).toHaveProperty("questions")
			expect(response.body.data.questions.length).toBe(mockQuestions.length)
			expect(response.body.data.questions[0].answers).toBeInstanceOf(Array) // Check answers structure
			expect(response.body.data.questions[0].answers.length).toBe(mockQuestions[0].answers.length)
			expect(response.body.data).not.toHaveProperty("fileUrl") // No file url when active
		})

		it("Employee should NOT get Leader-role training", async () => {
			const response = await request(app).get(`/training/test/${leaderTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(403)
		})

		it("Owner/Leader should get any inactive training in company", async () => {
			const response = await request(app).get(`/training/test/${empTrainingId}`).set("Cookie", OWNER_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.data.id).toBe(empTrainingId)
			expect(response.body.data.isActive).toBe(false)
			expect(response.body.data).not.toHaveProperty("questions")
		})
	})

	// =============================================
	// POST /training/
	// =============================================
	describe("POST /training/", () => {
		it("should 401 for unauthenticated user", async () => {
			const trainingData = {
				name: "New Training",
				description: "...",
				role: UserRole.Employee,
				questions: mockQuestions
			}
			const response = await request(app)
				.post("/training/")
				.field("data", JSON.stringify(trainingData))
			expect(response.status).toBe(401)
		})

		it("should 403 for Employee attempting creation", async () => {
			const trainingData = {
				name: "New Training",
				description: "...",
				role: UserRole.Employee,
				questions: mockQuestions
			}
			if (!fs.existsSync(dummyFilePath)) {
				fs.writeFileSync(dummyFilePath, "dummy")
			}

			const response = await request(app)
				.post("/training/")
				.set("Cookie", EMPLOYEE_COOKIE)
				.field("data", JSON.stringify(trainingData))
				.attach("file", dummyFilePath)
			expect(response.status).toBe(403)
			if (fs.existsSync(dummyFilePath)) {
				fs.unlinkSync(dummyFilePath)
			}
		})

		it("should return 400 if no file is provided", async () => {
			const trainingData = {
				name: "No File Training Test",
				description: "Testing creation without attaching a file.",
				role: UserRole.Employee,
				questions: mockQuestions
			}

			// Make the request, sending JSON data in the 'data' field, but *not* attaching a file
			const response = await request(app)
				.post("/training/")
				.set("Cookie", OWNER_COOKIE)
				.field("data", JSON.stringify(trainingData))

			expect(response.status).toBe(400)
			expect(response.body.status).toBe("error")
			expect(response.body.message).toContain("Training file is required.")
		})

		// Test creating WITH a file
		it("Owner should create training with file", async () => {
			const trainingData = {
				name: "Owner Training WithFile",
				description: "...",
				role: UserRole.Leader,
				questions: mockQuestions
			}
			const filePath = "tests/utility/testFile.pdf" // Dummy file
			try {
				require("fs").writeFileSync(filePath, "dummy pdf content")
			} catch {
			}

			const response = await request(app)
				.post("/training/")
				.set("Cookie", OWNER_COOKIE)
				.field("data", JSON.stringify(trainingData))
				.attach("file", filePath) // Attach the file

			expect(response.status).toBe(201)
			const dbCheck = await pool.query("SELECT id, name, file_url FROM training WHERE name = $1", [trainingData.name])
			expect(dbCheck.rowCount).toBe(1)
			expect(dbCheck.rows[0].file_url).toContain(`trainings/${MOCK_COMPANY_ID}/owner-training-withfile_`)
			expect(dbCheck.rows[0].file_url).toContain(".pdf")

			try {
				require("fs").unlinkSync(filePath)
			} catch {
			}
		})

		it("should 400 for duplicate training name", async () => {
			if (!fs.existsSync(dummyFilePath)) {
				fs.writeFileSync(dummyFilePath, "dummy")
			}

			const initialTrainingData = {
				name: "Duplicate Name",
				description: "Desc",
				role: UserRole.Employee,
				questions: mockQuestions
			}
			await request(app)
				.post("/training/")
				.set("Cookie", OWNER_COOKIE)
				.field("data", JSON.stringify(initialTrainingData))
				.attach("file", dummyFilePath)

			const duplicateTrainingData = {
				name: "Duplicate Name",
				description: "...",
				role: UserRole.Employee,
				questions: mockQuestions
			}
			const response = await request(app)
				.post("/training/")
				.set("Cookie", OWNER_COOKIE)
				.field("data", JSON.stringify(duplicateTrainingData))
				.attach("file", dummyFilePath)

			expect(response.status).toBe(400)
			expect(response.body.message).toContain("already exists")

			if (fs.existsSync(dummyFilePath)) {
				fs.unlinkSync(dummyFilePath)
			}
		})

		it("should 400 for invalid training data (Zod)", async () => {
			const invalidTrainingData = {name: "N", description: "d", role: 99, questions: []}
			if (!fs.existsSync(dummyFilePath)) {
				fs.writeFileSync(dummyFilePath, "dummy")
			}

			const response = await request(app)
				.post("/training/")
				.set("Cookie", OWNER_COOKIE)
				.field("data", JSON.stringify(invalidTrainingData))
				.attach("file", dummyFilePath)

			expect(response.status).toBe(400)
			expect(response.body.message).toContain("Invalid training data")

			if (fs.existsSync(dummyFilePath)) {
				fs.unlinkSync(dummyFilePath)
			}
		})
	})

	// =============================================
	// POST /training/start/:testId
	// =============================================
	describe("POST /training/start/:testId", () => {
		let empTrainingId: string
		let leaderTrainingId: string

		beforeEach(async () => {
			empTrainingId = await createTrainingInDb("Start Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
			leaderTrainingId = await createTrainingInDb("Start Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, mockQuestions, "dummy/emp.pdf")
		})

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).post(`/training/start/${empTrainingId}`)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent testId", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app).post(`/training/start/${nonExistentId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(404)
		})

		it("Employee should start Employee-role training", async () => {
			const response = await request(app).post(`/training/start/${empTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(200)
			expect(response.body.message).toContain("Training started successfully")
			const dbCheck = await pool.query("SELECT 1 FROM training_in_progress WHERE user_id = $1 AND training_id = $2", [MOCK_EMPLOYEE_ID, empTrainingId])
			expect(dbCheck.rowCount).toBe(1)
		})

		it("Employee should NOT start Leader-role training", async () => {
			const response = await request(app).post(`/training/start/${leaderTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(403)
			expect(response.body.message).toContain("permission to start this training")
		})

		it("should return 400 if training already active for user", async () => {
			await startTrainingForUser(MOCK_EMPLOYEE_ID, empTrainingId)
			const response = await request(app).post(`/training/start/${empTrainingId}`).set("Cookie", EMPLOYEE_COOKIE)
			expect(response.status).toBe(400)
			expect(response.body.message).toContain("training is already active")
		})

		it("Leader should start any training in company", async () => {
			const responseEmp = await request(app).post(`/training/start/${empTrainingId}`).set("Cookie", LEADER_COOKIE)
			expect(responseEmp.status).toBe(200)
			const responseLeader = await request(app).post(`/training/start/${leaderTrainingId}`).set("Cookie", LEADER_COOKIE)
			expect(responseLeader.status).toBe(200)
		})
	})

	// =============================================
	// POST /training/submission/:testId
	// =============================================
	describe("POST /training/submission/:testId", () => {
		let empTrainingId: string
		let leaderTrainingId: string
		let validSubmissionData: any

		beforeEach(async () => {
			const specificQuestions = [
				{id: "q1-uuid", name: "Q1", answers: [{text: "A", correct: true}, {text: "B", correct: false}]},
				{id: "q2-uuid", name: "Q2", answers: [{text: "C", correct: false}, {text: "D", correct: true}]}
			]
			empTrainingId = await createTrainingInDb("Submit Emp Training", "Desc", UserRole.Employee, MOCK_COMPANY_ID, specificQuestions, "dummy/emp.pdf")
			leaderTrainingId = await createTrainingInDb("Submit Leader Training", "Desc", UserRole.Leader, MOCK_COMPANY_ID, specificQuestions, "dummy/emp.pdf")

			await startTrainingForUser(MOCK_EMPLOYEE_ID, empTrainingId)

			validSubmissionData = {
				id: empTrainingId,
				questions: [
					{id: "q1-uuid", answers: ["A"]}, // Correct answer for Q1
					{id: "q2-uuid", answers: ["C"]}  // Incorrect answer for Q2
				]
			}
		})

		it("should 401 for unauthenticated user", async () => {
			const response = await request(app).post(`/training/submission/${empTrainingId}`).send(validSubmissionData)
			expect(response.status).toBe(401)
		})

		it("should 404 for non-existent testId", async () => {
			const nonExistentId = "00000000-0000-0000-0000-000000000000"
			const response = await request(app)
				.post(`/training/submission/${nonExistentId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(validSubmissionData)
			expect(response.status).toBe(404)
		})

		it("should 400 for invalid submission data (Zod)", async () => {
			const invalidData = {id: empTrainingId, questions: [{id: "q1-uuid", answers: []}]}
			const response = await request(app)
				.post(`/training/submission/${empTrainingId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(invalidData)
			expect(response.status).toBe(400)
			expect(response.body.message).toContain("Invalid submission data")
		})

		it("Employee should submit for active Employee-role training", async () => {
			const response = await request(app)
				.post(`/training/submission/${empTrainingId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(validSubmissionData)

			expect(response.status).toBe(201)
			expect(response.body.message).toContain("Submission processed successfully")
			const subCheck = await pool.query("SELECT id, answers FROM submission WHERE user_id = $1 AND training_id = $2", [MOCK_EMPLOYEE_ID, empTrainingId])
			expect(subCheck.rowCount).toBe(1)
			expect(subCheck.rows[0].answers).toEqual(validSubmissionData.questions) // Check answers saved
			const activeCheck = await pool.query("SELECT 1 FROM training_in_progress WHERE user_id = $1 AND training_id = $2", [MOCK_EMPLOYEE_ID, empTrainingId])
			expect(activeCheck.rowCount).toBe(0) // Should be deleted
		})

		it("Employee should NOT submit for Leader-role training", async () => {
			const response = await request(app)
				.post(`/training/submission/${leaderTrainingId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(validSubmissionData)
			expect(response.status).toBe(403)
			expect(response.body.message).toContain("No permission to submit")
		})

		it("should update submission if submitting again", async () => {
			// First submission
			await request(app)
				.post(`/training/submission/${empTrainingId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(validSubmissionData)

			// Second submission (different answers)
			const updatedSubmissionData = {
				id: empTrainingId,
				questions: [
					{id: "q1-uuid", answers: ["B"]},
					{id: "q2-uuid", answers: ["D"]}
				]
			}
			const response = await request(app)
				.post(`/training/submission/${empTrainingId}`)
				.set("Cookie", EMPLOYEE_COOKIE)
				.send(updatedSubmissionData)

			expect(response.status).toBe(201)
			// Check DB: submission answers updated
			const subCheck = await pool.query("SELECT answers FROM submission WHERE user_id = $1 AND training_id = $2", [MOCK_EMPLOYEE_ID, empTrainingId])
			expect(subCheck.rowCount).toBe(1)
			expect(subCheck.rows[0].answers).toEqual(updatedSubmissionData.questions)
		})
	})
})