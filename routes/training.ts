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

interface Answer {
	text: string;
	correct: boolean;
}

interface Question {
	id: string;
	name: string;
	answers: Answer[];
}

interface UserAnswer {
	id: string;
	answers: string[];
}

interface AnswerEvaluation {
	correct: boolean;
	correctAnswers: string[];
	userAnswers: string[];
}

interface QuestionEvaluation extends AnswerEvaluation {
	questionId: string;
	questionName: string;
	multipleCorrect: boolean;
}

interface SubmissionEvaluation {
	totalQuestions: number;
	correctCount: number;
	incorrectCount: number;
	questionEvaluations: QuestionEvaluation[];
}

// Helper to determine if question has multiple correct answers
const hasMultipleCorrect = (answers: Answer[]): boolean => {
	return answers.filter(a => a.correct).length > 1
}

// Utility function to evaluate a submission against training questions
const evaluateSubmission = (questions: Question[], userAnswers: UserAnswer[]): SubmissionEvaluation => {
	const questionEvaluations: QuestionEvaluation[] = []
	let correctCount = 0

	questions.forEach(question => {
		const userAnswer = userAnswers.find(a => a.id === question.id)
		if (!userAnswer) return

		const correctAnswers = question.answers
			.filter(answer => answer.correct)
			.map(answer => answer.text)

		const isCorrect =
			userAnswer.answers.length === correctAnswers.length &&
			userAnswer.answers.every(answer =>
				correctAnswers.includes(answer)
			)

		if (isCorrect) correctCount++

		questionEvaluations.push({
			questionId: question.id,
			questionName: question.name,
			correct: isCorrect,
			correctAnswers, // Only used internally
			userAnswers: userAnswer.answers,
			multipleCorrect: hasMultipleCorrect(question.answers)
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

		// Base query to get trainings with additional fields
		const query = `
        SELECT t.id,
               t.name,
               t.description,
               t.created_at                                                                                                                                                                                                                           as "createdAt",
               EXISTS (SELECT 1
                       FROM training_in_progress ip
                       WHERE ip.user_id = $${user.user_metadata.role === UserRole.Employee ? "3" : "2"}
                   AND ip.training_id = t.id
               ) as "active",
               EXISTS (
                   SELECT 1 FROM submission s 
                   WHERE s.user_id = $${user.user_metadata.role === UserRole.Employee ? "3" : "2"}
                   AND s.training_id = t.id) as "completed"
        FROM training t
        WHERE t.company_id = $1
            ${Number(user.user_metadata.role) === UserRole.Employee
                    ? "AND t.role = $2"
                    : ""}
        ORDER BY t.created_at DESC
		`

		const params = [user.user_metadata.company_id]
		if (Number(user.user_metadata.role) === UserRole.Employee) {
			params.push(String(UserRole.Employee))
		}
		// Add user ID for the active/completed checks
		params.push(user.id)

		const result = await postgres.query(query, params)

		// Format the response
		const formattedTrainings = result.rows.map(row => ({
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.createdAt,
			active: row.active,
			completed: row.completed
		}))

		res.status(200).json({
			status: "ignore",
			message: "Trainings fetched successfully!",
			data: formattedTrainings
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /training/results (with optional testId query parameter)
router.get("/results", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const testId = req.query.testId as string

	try {
		let query: string
		let params: string[] = [user.user_metadata.company_id]
		let isSpecificTest = false

		if (testId) {
			// Query for specific test results
			isSpecificTest = true
			query = `
          SELECT s.id,
                 s.created_at as "createdAt",
                 u.name       as "userName",
                 t.name       as "trainingName",
                 t.questions  as "trainingQuestions",
                 s.answers    as "userAnswers",
                 t.role       as "trainingRole",
                 t.company_id as "companyId",
                 s.created_at as "createdAt"
          FROM submission s
                   JOIN "user" u ON s.user_id = u.id
                   JOIN training t ON s.training_id = t.id
          WHERE s.training_id = $1
			`
			params = [testId]

			if (Number(user.user_metadata.role) === UserRole.Employee) {
				query += ` AND s.user_id = $2`
				params.push(user.id)
			} else {
				query += ` AND s.company_id = $2`
				params.push(user.user_metadata.company_id)
			}
		} else {
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
			// Query for recent results (limit 10)
			query = `
          SELECT s.id,
                 s.created_at as "createdAt",
                 u.name       as "userName",
                 t.name       as "trainingName",
                 t.questions  as "trainingQuestions",
                 s.answers    as "userAnswers",
                 s.created_at as "createdAt"
          FROM submission s
                   JOIN "user" u ON s.user_id = u.id
                   JOIN training t ON s.training_id = t.id
          WHERE s.company_id = $1
          ORDER BY s.created_at DESC
          LIMIT 10
			`
		}

		const result = await postgres.query(query, params)

		if (isSpecificTest && result.rows.length === 0) {
			res.status(200).json({
				status: "ignore",
				message: "No submissions found for this training",
				data: []
			} satisfies ApiResponse)
			return
		}

		if (isSpecificTest && !hasPermission(user, "submission", "view", {
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

		const submissions = result.rows.map(row => {
			const evaluation = evaluateSubmission(
				row.trainingQuestions,
				row.userAnswers
			)

			const baseResult: TrainingResult = {
				id: row.id,
				userName: row.userName,
				trainingName: row.trainingName,
				totalQuestions: evaluation.totalQuestions,
				correctCount: evaluation.correctCount,
				incorrectCount: evaluation.incorrectCount,
				createdAt: row.createdAt
			}

			if (isSpecificTest) {
				const questionEvaluations: TrainingQuestionEvaluation[] = row.trainingQuestions.map((question: Question) => {
					const userAnswer = row.userAnswers.find((ua: UserAnswer) => ua.id === question.id)
					const selectedAnswers = userAnswer?.answers || []

					return {
						id: question.id,
						name: question.name,
						multipleCorrect: hasMultipleCorrect(question.answers),
						answers: question.answers.map(answer => ({
							name: answer.text,
							selectedByUser: selectedAnswers.includes(answer.text),
							correct: answer.correct
						}))
					}
				})

				return {
					...baseResult,
					questionEvaluations
				}
			}
			return baseResult
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

// Add these interfaces to match frontend expectations
interface TrainingResult {
	id: string;
	userName: string;
	trainingName: string;
	questionEvaluations?: TrainingQuestionEvaluation[];
	totalQuestions: number;
	incorrectCount: number;
	correctCount: number;
	createdAt: string;
}

interface TrainingQuestionEvaluation {
	id: string;
	name: string;
	answers: {
		id: string;
		name: string;
		selectedByUser: boolean;
		correct: boolean;
	}[];
	multipleCorrect: boolean;
}

// GET /training/test/:testId
router.get("/test/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const trainingId = req.params.testId

	try {
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

		let downloadUrl = null
		if (training.fileUrl) {
			try {
				const { data, error } = await supabase.storage
					.from("training-files")
					.createSignedUrl(training.fileUrl, 3600, {
						download: true
					})

				if (error) throw error
				downloadUrl = data.signedUrl
			} catch (err) {
				console.error("Error generating signed URL:", err)
				downloadUrl = null
			}
		}

		const activeResult = await postgres.query(
			"SELECT 1 FROM training_in_progress WHERE user_id = $1 AND training_id = $2",
			[user.id, trainingId]
		)
		const isActive = activeResult.rows.length > 0

		if (isActive) {
			const response = {
				id: training.id,
				name: training.name,
				description: training.description,
				isActive: true,
				questions: training.questions.map((q: any) => ({
					id: q.id,
					name: q.name,
					answers: q.answers.map((a: any) => a.text),
					multipleCorrect: hasMultipleCorrect(q.answers)
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
				fileUrl: downloadUrl,
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

		// Process questions to match frontend format
		const dbQuestions = questions.map(question => ({
			id: crypto.randomUUID(),
			name: question.name,
			answers: question.answers.map(a => ({
				text: a.text,
				correct: a.correct
			})),
			multipleCorrect: question.answers.filter(a => a.correct).length > 1
		}))

		const trainingId = crypto.randomUUID()

		// Upload file to Supabase if provided
		let filePath = null
		if (file) {
			const fileExt = file.originalname.split(".").pop()

			// Sanitize the training name for filename
			const sanitizedName = name
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "-")  // Replace special chars with hyphens
				.replace(/-+/g, "-")         // Remove consecutive hyphens
				.replace(/^-|-$/g, "")      // Remove leading/trailing hyphens

			const fileName = `${sanitizedName}_${trainingId}.${fileExt}`
			filePath = `trainings/${companyId}/${fileName}`

			const { error } = await supabase.storage
				.from("training-files")
				.upload(filePath, file.buffer, {
					contentType: file.mimetype,
					upsert: true
				})

			if (error) {
				res.status(500).json({
					status: "error",
					message: "Failed to upload file"
				})
				return
			}
		}

		await postgres.query(
			`INSERT INTO training (id, name, description, role, questions, file_url, company_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
			[trainingId, name, description, role, JSON.stringify(dbQuestions), filePath, companyId]
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
			"SELECT 1 FROM training_in_progress WHERE user_id = $1 AND training_id = $2",
			[user.id, trainingId]
		)

		if (activeCheck.rows.length > 0) {
			res.status(400).json({
				status: "error",
				message: "This training is already active for you"
			} satisfies ApiResponse)
			return
		}

		// Add to training_in_progress table
		await postgres.query(
			"INSERT INTO training_in_progress (user_id, training_id) VALUES ($1, $2)",
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

router.post("/submission/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const trainingId = req.params.testId

	try {
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

		const userAnswers: UserAnswer[] = questions.map(q => ({
			id: q.id,
			answers: q.answers
		}))

		try {
			await postgres.query(`
          INSERT INTO submission (id,
                                  user_id,
                                  company_id,
                                  training_id,
                                  answers,
                                  created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (user_id, training_id)
              DO UPDATE SET answers    = EXCLUDED.answers,
                            created_at = NOW(),
                            id         = EXCLUDED.id
			`, [
				id,
				user.id,
				training.company_id,
				trainingId,
				JSON.stringify(userAnswers)
			])
		} catch (insertError: any) {
			if (insertError.code !== "23505") throw insertError
		}

		await postgres.query(`
        DELETE
        FROM training_in_progress
        WHERE user_id = $1
          AND training_id = $2
		`, [user.id, trainingId])

		res.status(201).json({
			status: "success",
			message: "Submission processed successfully"
		})

	} catch (error) {
		next(error)
	}
})

export default router