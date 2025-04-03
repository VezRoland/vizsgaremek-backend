import { Router, type Request, type Response } from "express";
import postgres from "../lib/postgres";
import { getUserFromCookie } from "../lib/utils";
import type { ApiResponse } from "../types/response";
import type { User } from "@supabase/supabase-js";
import { UserRole } from "../types/database.ts"
import { hasPermission } from "../lib/roles.ts"
import { array, boolean, number, object, string } from "zod"

const router = Router();

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
	const questionEvaluations: QuestionEvaluation[] = [];
	let correctCount = 0;

	questions.forEach(question => {
		const userAnswer = userAnswers.find(a => a.id === question.id);
		if (!userAnswer) return;

		let isCorrect: boolean;
		let correctAnswers: string[];

		if (question.multipleCorrect) {
			// For multiple correct answers
			const correctIndices = Array.isArray(question.correctAnswer)
				? question.correctAnswer
				: [question.correctAnswer];
			correctAnswers = correctIndices.map(idx => question.answers[idx]);

			if (Array.isArray(userAnswer.answer)) {
				const userSelected = userAnswer.answer.map(ans =>
					question.answers.findIndex(a => a === ans)
				).filter(idx => idx !== -1);

				isCorrect = userSelected.length === correctIndices.length &&
					userSelected.every(idx => correctIndices.includes(idx));
			} else {
				isCorrect = false;
			}
		} else {
			// For single correct answer
			const correctIndex = Array.isArray(question.correctAnswer)
				? question.correctAnswer[0]
				: question.correctAnswer;
			correctAnswers = [question.answers[correctIndex]];

			isCorrect = question.answers[correctIndex] === userAnswer.answer;
		}

		if (isCorrect) correctCount++;

		questionEvaluations.push({
			questionId: question.id,
			questionName: question.name,
			correct: isCorrect,
			correctAnswers,
			userAnswer: userAnswer.answer
		});
	});

	return {
		totalQuestions: questions.length,
		correctCount,
		incorrectCount: questions.length - correctCount,
		questionEvaluations
	};
};

// GET /training (get all trainings for the user's role)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;

	try {
		// Check if user has permission to view submissions | This is only against admins, the query handles the rest
		if (!hasPermission(user, "training", "view", {
			companyId: user.user_metadata.company_id,
			role: Number(user.user_metadata.role)
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view trainings."
			} satisfies ApiResponse);
			return;
		}

		// Base query to get trainings
		const query = `
            SELECT 
                t.id, 
                t.name, 
                t.description, 
                jsonb_array_length(t.questions) as "questionCount"
            FROM training t
            WHERE t.company_id = $1
            ${Number(user.user_metadata.role) === UserRole.Employee
			? 'AND t.role = $2'
			: ''}
            ORDER BY t.created_at DESC
        `;

		const params = [user.user_metadata.company_id];
		if (Number(user.user_metadata.role) === UserRole.Employee) params.push(String(UserRole.Employee));

		const result = await postgres.query(query, params);

		res.status(200).json({
			status: "ignore",
			message: "Trainings fetched successfully!",
			data: result.rows
		} satisfies ApiResponse);
	} catch (error) {
		next(error);
	}
});

// GET /training/submissions (get 10 most recent submissions with correctness counts)
router.get("/submissions", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;

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
			} satisfies ApiResponse);
			return;
		}

		// Query to get submissions with training questions
		const query = `
        SELECT
            s.id,
            s.created_at as "createdAt",
            u.name as "userName",
            t.name as "trainingName",
            t.questions as "trainingQuestions",
            s.answers as "userAnswers"
        FROM submission s
                 JOIN "user" u ON s.user_id = u.id
                 JOIN training t ON s.training_id = t.id
        WHERE s.company_id = $1
        ORDER BY s.created_at DESC
        LIMIT 10
		`;

		const result = await postgres.query(query, [user.user_metadata.company_id]);

		// Process submissions to get counts only
		const submissions = result.rows.map(row => {
			let correctCount = 0;
			const questions: Question[] = row.trainingQuestions;
			const userAnswers: UserAnswer[] = row.userAnswers;

			questions.forEach(question => {
				const userAnswer = userAnswers.find(a => a.id === question.id);
				if (!userAnswer) return;

				const correctIndex = Array.isArray(question.correctAnswer)
					? question.correctAnswer[0]
					: question.correctAnswer;

				if (question.answers[correctIndex] === userAnswer.answer) {
					correctCount++;
				}
			});

			return {
				id: row.id,
				createdAt: row.createdAt,
				userName: row.userName,
				trainingName: row.trainingName,
				totalQuestions: questions.length,
				correctCount,
				incorrectCount: questions.length - correctCount
			};
		});

		res.status(200).json({
			status: "ignore",
			message: "Submissions fetched successfully!",
			data: submissions
		} satisfies ApiResponse);
	} catch (error) {
		next(error);
	}
});

// GET /training/submissions?testId= (get all submissions for a specific training)
router.get("/submissions", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;
	const testId = req.query.testId as string;

	try {
		if (!testId) {
			res.status(400).json({
				status: "error",
				message: "testId query parameter is required"
			} satisfies ApiResponse);
			return;
		}

		// Base query with common joins
		let query = `
            SELECT
                s.id,
                s.created_at as "createdAt",
                u.name as "userName",
                t.name as "trainingName",
                t.questions as "trainingQuestions",
                s.answers as "userAnswers",
                t.role as "trainingRole",
                t.company_id as "companyId"
            FROM submission s
            JOIN "user" u ON s.user_id = u.id
            JOIN training t ON s.training_id = t.id
            WHERE s.training_id = $1
        `;

		const params: string[] = [testId];

		// Add role-specific conditions
		if (Number(user.user_metadata.role) === UserRole.Employee) {
			query += ` AND s.user_id = $2`;
			params.push(user.id);
		} else {
			// For Owners/Leaders - only their company's submissions
			query += ` AND s.company_id = $2`;
			params.push(user.user_metadata.company_id);
		}

		query += ` ORDER BY s.created_at DESC`;

		const result = await postgres.query(query, params);

		if (result.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "No submissions found for this training"
			} satisfies ApiResponse);
			return;
		}

		if (!hasPermission(user, "submission", "view", {
			companyId: result.rows[0].companyId,
			role: Number(result.rows[0].trainingRole),
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view submissions."
			} satisfies ApiResponse);
			return;
		}

		// Process submissions with full evaluation
		const submissions = result.rows.map(row => {
			const evaluation = evaluateSubmission(
				row.trainingQuestions,
				row.userAnswers
			);

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
			};
		});

		res.status(200).json({
			status: "ignore",
			message: "Submissions fetched successfully!",
			data: submissions
		} satisfies ApiResponse);
	} catch (error) {
		next(error);
	}
});

// GET /training/:id (get specific training data with conditional questions)
router.get("/test/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;
	const trainingId = req.params.testId;

	try {
		// First get the training data including the url column
		const trainingQuery = `
        SELECT
            t.id,
            t.name,
            t.description,
            t.questions,
            t.file_url,
            t.company_id as "companyId",
            t.role
        FROM training t
        WHERE t.id = $1
		`;

		const trainingResult = await postgres.query(trainingQuery, [trainingId]);

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			} satisfies ApiResponse);
			return;
		}

		const training = trainingResult.rows[0];

		// Check if training is active for this user
		const activeQuery = `
        SELECT 1
        FROM in_progress
        WHERE user_id = $1 AND training_id = $2
		`;
		const activeResult = await postgres.query(activeQuery, [user.id, trainingId]);
		const isActive = activeResult.rows.length > 0;

		// Check permission AFTER getting the training data
		if (!hasPermission(user, "training", "view", {
			companyId: training.companyId,
			role: training.role
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to view this training."
			} satisfies ApiResponse);
			return;
		}

		// Prepare base response
		const response: any = {
			id: training.id,
			name: training.name,
			description: training.description,
			isActive
		};

		if (isActive) {
			// Include questions when active
			response.questions = training.questions.map((question: Question) => ({
				id: question.id,
				name: question.name,
				answers: question.answers,
				multipleCorrect: question.multipleCorrect
			}));
		} else {
			// Include url only when not active
			response.fileUrl = training.file_url;
		}

		res.status(200).json({
			status: "ignore",
			message: "Training fetched successfully",
			data: response
		} satisfies ApiResponse);
	} catch (error) {
		next(error);
	}
});

// Validation schema for a question
const questionSchema = object({
	id: string().min(1),
	name: string().min(1),
	answers: array(string().min(1)).min(2),
	correctAnswer: number().or(array(number())),
	multipleCorrect: boolean()
});

// Validation schema for the request body
const createTrainingSchema = object({
	name: string().min(3),
	description: string().min(10),
	role: number().min(1).max(4),
	questions: array(questionSchema).min(1),
	fileUrl: string().url().optional()
});

// POST /training (create a new training)
router.post("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;

	try {
		// Validate request body
		const validation = createTrainingSchema.safeParse(req.body);
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid training data",
				errors: validation.error.errors
			} satisfies ApiResponse);
			return
		}

		const { name, description, role, questions, fileUrl } = validation.data;
		const companyId = user.user_metadata.company_id;

		// Check permissions
		if (!hasPermission(user, "training", "create", {
			companyId,
			role: Number(user.user_metadata.role) // Role is ignored here, it's handled by the function and the user object
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to create trainings"
			} satisfies ApiResponse);
			return
		}

		// Check for duplicate training name in the same company
		const duplicateCheck = await postgres.query(
			"SELECT 1 FROM training WHERE name = $1 AND company_id = $2",
			[name, companyId]
		);

		if (duplicateCheck.rows.length > 0) {
			res.status(400).json({
				status: "error",
				message: "A training with this name already exists in your company"
			} satisfies ApiResponse);
			return
		}

		// Additional validation for questions
		for (const question of questions) {
			// Validate correctAnswer indices
			if (question.multipleCorrect) {
				const correctIndices = Array.isArray(question.correctAnswer)
					? question.correctAnswer
					: [question.correctAnswer];

				if (correctIndices.some(idx => idx < 0 || idx >= question.answers.length)) {
					res.status(400).json({
						status: "error",
						message: `Question "${question.name}" has invalid correctAnswer indices`
					} satisfies ApiResponse);
					return
				}
			} else {
				const idx = Array.isArray(question.correctAnswer)
					? question.correctAnswer[0]
					: question.correctAnswer;

				if (idx < 0 || idx >= question.answers.length) {
					res.status(400).json({
						status: "error",
						message: `Question "${question.name}" has invalid correctAnswer index`
					} satisfies ApiResponse);
					return
				}
			}
		}

		// Insert into database
		await postgres.query(
			`INSERT INTO training (
                name, 
                description, 
                role, 
                questions, 
                file_url, 
                company_id
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
			[name, description, role, questions, fileUrl, companyId]
		);

		res.status(201).json({
			status: "success",
			message: "Training created successfully"
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});

// POST /training/start/:test_id (mark training as active for user)
router.post("/start/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;
	const trainingId = req.params.testId;

	try {
		// First check if the training exists and get its company_id
		const trainingQuery = `
            SELECT company_id, role 
            FROM training 
            WHERE id = $1
        `;
		const trainingResult = await postgres.query(trainingQuery, [trainingId]);

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			} satisfies ApiResponse);
			return
		}

		const training = trainingResult.rows[0];

		// Check if user has permission to submit to this training
		if (!hasPermission(user, "submission", "create", {
			companyId: training.company_id,
			role: training.role,
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to start this training"
			} satisfies ApiResponse);
			return
		}

		// Check if training is already active for this user
		const activeCheck = await postgres.query(
			"SELECT 1 FROM in_progress WHERE user_id = $1 AND training_id = $2",
			[user.id, trainingId]
		);

		if (activeCheck.rows.length > 0) {
			res.status(400).json({
				status: "error",
				message: "This training is already active for you"
			} satisfies ApiResponse);
			return
		}

		// Add to in_progress table
		await postgres.query(
			"INSERT INTO in_progress (user_id, training_id) VALUES ($1, $2)",
			[user.id, trainingId]
		);

		res.status(200).json({
			status: "success",
			message: "Training started successfully"
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});

// Validation schema for submission request body
const submissionSchema = object({
	questions: array(
		object({
			id: string().min(1),
			answers: array(string().min(1)).min(1)
		})
	).min(1)
});

// POST /training/submission/:test_id (create a submission)
router.post("/submission/:testId", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User;
	const trainingId = req.params.testId; // Get training ID from route parameter

	try {
		// Validate request body (without id)
		const validation = submissionSchema.safeParse(req.body);
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid submission data",
				errors: validation.error.errors
			} satisfies ApiResponse);
			return
		}

		const { questions } = validation.data;

		// Get training data for permission check and question validation
		const trainingQuery = `
        SELECT id, company_id, role, questions
        FROM training
        WHERE id = $1
		`;
		const trainingResult = await postgres.query(trainingQuery, [trainingId]);

		if (trainingResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Training not found"
			} satisfies ApiResponse);
			return
		}

		const training = trainingResult.rows[0];

		// Check permission to submit
		if (!hasPermission(user, "submission", "create", {
			companyId: training.company_id,
			role: training.role,
			userId: user.id
		})) {
			res.status(403).json({
				status: "error",
				message: "You don't have permission to submit to this training"
			} satisfies ApiResponse);
			return
		}

		// Validate all questions are answered
		const trainingQuestions: Question[] = training.questions;
		const unansweredQuestions = trainingQuestions.filter(tq =>
			!questions.some(q => q.id === tq.id)
		);

		if (unansweredQuestions.length > 0) {
			res.status(400).json({
				status: "error",
				message: "Some questions were not answered",
				data: unansweredQuestions.map(q => q.id)
			} satisfies ApiResponse);
			return
		}

		// Validate no extra questions are included
		const extraQuestions = questions.filter(q =>
			!trainingQuestions.some(tq => tq.id === q.id)
		);

		if (extraQuestions.length > 0) {
			res.status(400).json({
				status: "error",
				message: "Invalid questions included in submission",
				data: extraQuestions.map(q => q.id)
			} satisfies ApiResponse);
			return
		}

		// Prepare answers in required format
		const userAnswers: UserAnswer[] = questions.map(q => ({
			id: q.id,
			answer: q.answers.length === 1 ? q.answers[0] : q.answers
		}));

		// Insert submission
		await postgres.query(
			`INSERT INTO submission (
          user_id,
          company_id,
          training_id,
          answers
      ) VALUES ($1, $2, $3, $4)`,
			[user.id, training.company_id, trainingId, userAnswers]
		);

		// Remove from in_progress
		await postgres.query(
			`DELETE FROM in_progress
       WHERE user_id = $1 AND training_id = $2`,
			[user.id, trainingId]
		);

		// Evaluate and return results
		const evaluation = evaluateSubmission(trainingQuestions, userAnswers);

		res.status(201).json({
			status: "success",
			message: "Submission created successfully",
			data: {
				totalQuestions: evaluation.totalQuestions,
				correctCount: evaluation.correctCount,
				incorrectCount: evaluation.incorrectCount,
				questionEvaluations: evaluation.questionEvaluations.map(q => ({
					questionId: q.questionId,
					questionName: q.questionName,
					userAnswer: q.userAnswer,
					correct: q.correct
				}))
			}
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});

export default router;