import { Router, type Request, type Response } from "express"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ApiResponse } from "../types/response"
import type { User } from "@supabase/supabase-js"
import { UserRole } from "../types/database.ts"
import { hasPermission } from "../lib/roles.ts"
import { array, boolean, number, object, string } from "zod"
import { supabase } from "../lib/supabase.ts"
import multer from "multer"
import type { Multer } from "multer"

const router = Router()

interface Question {
	id: string;
	name: string;
	answers: string[];
	correctAnswer: number | number[];
	multipleCorrect: boolean;
}

interface UserAnswer {
	id: string;
	answer: string | string[];
}

interface AnswerEvaluation {
	correct: boolean;
	correctAnswers: string[];
	userAnswer: string | string[];
}

interface QuestionEvaluation extends AnswerEvaluation {
	questionId: string;
	questionName: string;
}

interface SubmissionEvaluation {
	totalQuestions: number;
	correctCount: number;
	incorrectCount: number;
	questionEvaluations: QuestionEvaluation[];
}

// Utility function to evaluate a submission against training questions
const evaluateSubmission = (questions: Question[], userAnswers: UserAnswer[]): SubmissionEvaluation => {
	const questionEvaluations: QuestionEvaluation[] = []
	let correctCount = 0

	questions.forEach(question => {
		const userAnswer = userAnswers.find(a => a.id === question.id)
		if (!userAnswer) return

		let isCorrect: boolean
		let correctAnswers: string[]

		if (question.multipleCorrect) {
			// For multiple correct answers
			const correctIndices = Array.isArray(question.correctAnswer)
				? question.correctAnswer
				: [question.correctAnswer]
			correctAnswers = correctIndices.map(idx => question.answers[idx])

			if (Array.isArray(userAnswer.answer)) {
				const userSelected = userAnswer.answer.map(ans =>
					question.answers.findIndex(a => a === ans)
				).filter(idx => idx !== -1)

				isCorrect = userSelected.length === correctIndices.length &&
					userSelected.every(idx => correctIndices.includes(idx))
			} else {
				isCorrect = false
			}
		} else {
			// For single correct answer
			const correctIndex = Array.isArray(question.correctAnswer)
				? question.correctAnswer[0]
				: question.correctAnswer
			correctAnswers = [question.answers[correctIndex]]

			isCorrect = question.answers[correctIndex] === userAnswer.answer
		}

		if (isCorrect) correctCount++

		questionEvaluations.push({
			questionId: question.id,
			questionName: question.name,
			correct: isCorrect,
			correctAnswers,
			userAnswer: userAnswer.answer
		})
	})

	return {
		totalQuestions: questions.length,
		correctCount,
		incorrectCount: questions.length - correctCount,
		questionEvaluations
	}
}

// GET /training (get all trainings for the user's role)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		// Check if user has permission to view submissions | This is only against admins, the query handles the rest
		if (!hasPermission(user, "training", "view", {
			companyId: user.user_metadata.company_id,
			role: Number(user.user_metadata.role)
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view trainings."
			} satisfies ApiResponse)
			return
		}

		// Base query to get trainings
		const query = `
        SELECT t.id,
               t.name,
               t.description,
               jsonb_array_length(t.questions) as "questionCount"
        FROM training t
        WHERE t.company_id = $1
            ${Number(user.user_metadata.role) === UserRole.Employee
                    ? "AND t.role = $2"
                    : ""}
        ORDER BY t.created_at DESC
		`

		const params = [user.user_metadata.company_id]
		if (Number(user.user_metadata.role) === UserRole.Employee) params.push(String(UserRole.Employee))

		const result = await postgres.query(query, params)

		res.status(200).json({
			status: "ignore",
			message: "Trainings fetched successfully!",
			data: result.rows
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /training/submissions (get 10 most recent submissions with correctness counts)
router.get("/submissions", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		// Check if user has permission to view submissions | This is only against admins and employees
		if (!hasPermission(user, "submission", "view", {
			companyId: user.user_metadata.company_id,
			role: Number(user.user_metadata.role),
			userId: user.id
		}) || Number(user.user_metadata.role) === UserRole.Employee) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view submissions."
			} satisfies ApiResponse)
			return
		}

		// Query to get submissions with training questions
		const query = `
        SELECT s.id,
               s.created_at as "createdAt",
               u.name       as "userName",
               t.name       as "trainingName",
               t.questions  as "trainingQuestions",
               s.answers    as "userAnswers"
        FROM submission s
                 JOIN "user" u ON s.user_id = u.id
                 JOIN training t ON s.training_id = t.id
        WHERE s.company_id = $1
        ORDER BY s.created_at DESC
        LIMIT 10
		`

		const result = await postgres.query(query, [user.user_metadata.company_id])

		// Process submissions to get counts only
		const submissions = result.rows.map(row => {
			let correctCount = 0
			const questions: Question[] = row.trainingQuestions
			const userAnswers: UserAnswer[] = row.userAnswers

			questions.forEach(question => {
				const userAnswer = userAnswers.find(a => a.id === question.id)
				if (!userAnswer) return

				const correctIndex = Array.isArray(question.correctAnswer)
					? question.correctAnswer[0]
					: question.correctAnswer

				if (question.answers[correctIndex] === userAnswer.answer) {
					correctCount++
				}
			})

			return {
				id: row.id,
				createdAt: row.createdAt,
				userName: row.userName,
				trainingName: row.trainingName,
				totalQuestions: questions.length,
				correctCount,
				incorrectCount: questions.length - correctCount
			}
		})

		res.status(200).json({
			status: "ignore",
			message: "Submissions fetched successfully!",
			data: submissions
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /training/submissions?testId= (get all submissions for a specific training)
router.get("/submissions", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const testId = req.query.testId as string

	try {
		if (!testId) {
			res.status(400).json({
				status: "error",
				message: "testId query parameter is required"
			} satisfies ApiResponse)
			return
		}

		// Base query with common joins
		let query = `
        SELECT s.id,
               s.created_at as "createdAt",
               u.name       as "userName",
               t.name       as "trainingName",
               t.questions  as "trainingQuestions",
               s.answers    as "userAnswers",
               t.role       as "trainingRole",
               t.company_id as "companyId"
        FROM submission s
                 JOIN "user" u ON s.user_id = u.id
                 JOIN training t ON s.training_id = t.id
        WHERE s.training_id = $1
		`

		const params: string[] = [testId]

		// Add role-specific conditions
		if (Number(user.user_metadata.role) === UserRole.Employee) {
			query += ` AND s.user_id = $2`
			params.push(user.id)
		} else {
			// For Owners/Leaders - only their company's submissions
			query += ` AND s.company_id = $2`
			params.push(user.user_metadata.company_id)
		}

		query += ` ORDER BY s.created_at DESC`

		const result = await postgres.query(query, params)

		if (result.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "No submissions found for this training"
			} satisfies ApiResponse)
			return
		}

		if (!hasPermission(user, "submission", "view", {
			companyId: result.rows[0].companyId,
			role: Number(result.rows[0].trainingRole),
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view submissions."
			} satisfies ApiResponse)
			return
		}

		// Process submissions with full evaluation
		const submissions = result.rows.map(row => {
			const evaluation = evaluateSubmission(
				row.trainingQuestions,
				row.userAnswers
			)

			return {
				id: row.id,
				createdAt: row.createdAt,
				userName: row.userName,
				trainingName: row.trainingName,
				totalQuestions: evaluation.totalQuestions,
				correctCount: evaluation.correctCount,
				incorrectCount: evaluation.incorrectCount,
				questionEvaluations: evaluation.questionEvaluations.map(q => ({
					questionId: q.questionId,
					questionName: q.questionName,
					correct: q.correct,
					userAnswer: q.userAnswer,
					correctAnswers: q.correctAnswers
				}))
			}
		})

		res.status(200).json({
			status: "ignore",
			message: "Submissions fetched successfully!",
			data: submissions
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /training/test/:testId
router.get("/test/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const trainingId = req.params.testId

	try {
		// Get training data
		const trainingResult = await postgres.query(`
        SELECT t.id,
               t.name,
               t.description,
               t.questions,
               t.file_url   as "fileUrl",
               t.company_id as "companyId",
               t.role,
               t.created_at as "createdAt"
        FROM training t
        WHERE t.id = $1
		`, [trainingId])

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			})
			return
		}

		const training = trainingResult.rows[0]

		// Check permission
		if (!hasPermission(user, "training", "view", {
			companyId: training.companyId,
			role: training.role
		})) {
			res.status(403).json({
				status: "error",
				message: "No permission to view this training"
			})
			return
		}

		// Check if active
		const activeResult = await postgres.query(
			"SELECT 1 FROM in_progress WHERE user_id = $1 AND training_id = $2",
			[user.id, trainingId]
		)
		const isActive = activeResult.rows.length > 0

		// Format response based on activity status
		if (isActive) {
			const response = {
				id: training.id,
				name: training.name,
				description: training.description,
				isActive: true,
				questions: training.questions.map((q: any) => ({
					id: q.id,
					name: q.name,
					answers: q.answers,
					multipleCorrect: q.multipleCorrect
				})),
				createdAt: training.createdAt
			}
			res.status(200).json({
				status: "ignore",
				message: "Active training fetched successfully",
				data: response
			})
		} else {
			const response = {
				id: training.id,
				name: training.name,
				description: training.description,
				fileUrl: training.fileUrl,
				isActive: false,
				createdAt: training.createdAt
			}
			res.status(200).json({
				status: "ignore",
				message: "Inactive training fetched successfully",
				data: response
			})
		}

	} catch (error) {
		next(error)
	}
})

const trainingAnswerSchema = object({
	text: string().min(1),
	correct: boolean()
})

const trainingQuestionSchema = object({
	name: string().min(1),
	answers: array(trainingAnswerSchema)
		.min(2)
		.max(4)
}).refine(data => data.answers.some(answer => answer.correct), {
	message: "At least one answer should be marked as correct",
	path: ["answers"]
})

const trainingCreateSchema = object({
	name: string().min(1),
	description: string().min(1),
	role: number().min(1).max(4),
	questions: array(trainingQuestionSchema).min(1)
})

// Configure multer for memory storage (files will be in memory as Buffers)
const upload: Multer = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024 // 5MB file size limit
	}
})

// POST /training (create new training with file upload)
router.post("/", upload.single("file"), getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		const file = req.file
		const data = JSON.parse(req.body.data)

		// Parse form data
		const validation = trainingCreateSchema.safeParse(data)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid training data",
				errors: validation.error.errors
			})
			return
		}

		const { name, description, role, questions } = validation.data
		const companyId = user.user_metadata.company_id

		// Check permissions
		if (!hasPermission(user, "training", "create", {
			companyId,
			role: Number(user.user_metadata.role)
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to create trainings"
			})
			return
		}

		// Check for duplicate training name
		const duplicateCheck = await postgres.query(
			"SELECT 1 FROM training WHERE name = $1 AND company_id = $2",
			[name, companyId]
		)
		if (duplicateCheck.rows.length > 0) {
			res.status(400).json({
				status: "error",
				message: "A training with this name already exists"
			})
			return
		}

		// Process questions to match database format
		const dbQuestions = questions.map(question => ({
			id: crypto.randomUUID(),
			name: question.name,
			answers: question.answers.map(a => a.text),
			correctAnswer: question.answers.findIndex(a => a.correct),
			multipleCorrect: question.answers.filter(a => a.correct).length > 1
		}))

		// Upload file to Supabase if provided
		let fileUrl = null
		if (file) {
			const fileExt = file.originalname.split(".").pop()
			const fileName = `${crypto.randomUUID()}.${fileExt}`
			const filePath = `trainings/${companyId}/${fileName}`

			const { error } = await supabase.storage
				.from("training-files")
				.upload(filePath, file.buffer, {
					contentType: file.mimetype
				})

			if (error) {
				res.status(500).json({
					status: "error",
					message: "Failed to upload file"
				})
				return
			}

			fileUrl = supabase.storage
				.from("training-files")
				.getPublicUrl(filePath).data.publicUrl
		}

		// Insert into database
		await postgres.query(
			`INSERT INTO training (name,
                             description,
                             role,
                             questions,
                             file_url,
                             company_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
			[name, description, role, dbQuestions, fileUrl, companyId]
		)

		res.status(201).json({
			status: "success",
			message: "Training created successfully"
		})

	} catch (error) {
		next(error)
	}
})

// POST /training/start/:test_id (mark training as active for user)
router.post("/start/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const trainingId = req.params.testId

	try {
		// First check if the training exists and get its company_id
		const trainingQuery = `
        SELECT company_id, role
        FROM training
        WHERE id = $1
		`
		const trainingResult = await postgres.query(trainingQuery, [trainingId])

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			} satisfies ApiResponse)
			return
		}

		const training = trainingResult.rows[0]

		// Check if user has permission to submit to this training
		if (!hasPermission(user, "submission", "create", {
			companyId: training.company_id,
			role: training.role,
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to start this training"
			} satisfies ApiResponse)
			return
		}

		// Check if training is already active for this user
		const activeCheck = await postgres.query(
			"SELECT 1 FROM in_progress WHERE user_id = $1 AND training_id = $2",
			[user.id, trainingId]
		)

		if (activeCheck.rows.length > 0) {
			res.status(400).json({
				status: "error",
				message: "This training is already active for you"
			} satisfies ApiResponse)
			return
		}

		// Add to in_progress table
		await postgres.query(
			"INSERT INTO in_progress (user_id, training_id) VALUES ($1, $2)",
			[user.id, trainingId]
		)

		res.status(200).json({
			status: "success",
			message: "Training started successfully"
		} satisfies ApiResponse)

	} catch (error) {
		next(error)
	}
})

// Validation schema for submission request body
const trainingSubmissionQuestionSchema = object({
	id: string(),
	answers: string().array().min(1, "At least one answer should be selected")
})

const trainingSubmissionSchema = object({
	id: string(),
	questions: array(trainingSubmissionQuestionSchema)
})

// POST /training/submission/:testId
router.post("/submission/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const trainingId = req.params.testId

	try {
		// Validate request body
		const validation = trainingSubmissionSchema.safeParse(req.body)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid submission data",
				errors: validation.error.errors
			})
			return
		}

		const { id, questions } = validation.data

		// Get training data
		const trainingResult = await postgres.query(`
        SELECT id, company_id, role, questions
        FROM training
        WHERE id = $1
		`, [trainingId])

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			})
			return
		}

		const training = trainingResult.rows[0]

		// Check permission
		if (!hasPermission(user, "submission", "create", {
			companyId: training.company_id,
			role: training.role,
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "No permission to submit"
			})
			return
		}

		// Validate questions
		const trainingQuestions = training.questions
		const userAnswers: UserAnswer[] = questions.map(q => ({
			id: q.id,
			answer: q.answers.length === 1 ? q.answers[0] : q.answers
		}))

		// Create submission
		await postgres.query(`
        INSERT INTO submission (id,
                                user_id,
                                company_id,
                                training_id,
                                answers)
        VALUES ($1, $2, $3, $4, $5)
		`, [id, user.id, training.company_id, trainingId, userAnswers])

		// Remove from in_progress
		await postgres.query(`
        DELETE
        FROM in_progress
        WHERE user_id = $1
          AND training_id = $2
		`, [user.id, trainingId])

		// Evaluate and return results
		const evaluation = evaluateSubmission(trainingQuestions, userAnswers)
		const response = {
			id,
			name: user.user_metadata.name,
			training: training.name,
			score: {
				totalQuestions: evaluation.totalQuestions,
				correctCount: evaluation.correctCount,
				incorrectCount: evaluation.incorrectCount,
				questionEvaluations: evaluation.questionEvaluations.map(q => ({
					questionId: q.questionId,
					questionName: q.questionName,
					userAnswer: q.userAnswer,
					correct: q.correct
				}))
			},
			submittedAt: new Date().toISOString()
		}

		res.status(201).json({
			status: "success",
			data: response
		})

	} catch (error) {
		next(error)
	}
})

export default router