import { Router, type Request, type Response } from "express"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ApiResponse } from "../types/response"
import type { User } from "@supabase/supabase-js"
import { hasPermission } from "../lib/roles"
import { type Schedule, UserRole } from "../types/database"
import { object, string, number, boolean } from "zod"

const router = Router()

// Current week
const getStartOfWeek = (date: Date): Date => {
	const day = date.getDay()
	const diff = date.getDate() - day + (day === 0 ? -6 : 1)
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		diff,
		0, 0, 0, 0
	)
}

const getEndOfWeek = (date: Date): Date => {
	const start = getStartOfWeek(date)
	return new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate() + 6,
		23, 59, 59, 999
	)
}

// Previous week
const getPrevWeekStart = (date: Date): Date => {
	const start = getStartOfWeek(date)
	return new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate() - 7,
		0, 0, 0, 0
	)
}

// Next week
const getNextWeekStart = (date: Date): Date => {
	const start = getStartOfWeek(date)
	return new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate() + 7,
		0, 0, 0, 0
	)
}

// Utility function to check for overlapping schedules
const hasOverlappingSchedules = async (userId: string, start: Date, end: Date, excludeScheduleId?: string): Promise<boolean> => {
	// Base query without exclusion
	let query = `
      SELECT EXISTS(
                 SELECT 1 FROM schedule
                 WHERE user_id = $1
                   AND (
                     (start <= $2 AND $3 <= "end") OR
                     (start <= $4 AND $5 <= "end") OR
                     ($2 <= start AND "end" <= $4)
                     ) -- Not an error, ignore
	`;

	console.log(start, end)

	const params: any[] = [
		userId,
		start.toISOString(),
		start.toISOString(),
		end.toISOString(),
		end.toISOString()
	];

	// Add exclusion if needed
	if (excludeScheduleId) {
		query += ` AND id != $${params.length + 1}`;
		params.push(excludeScheduleId);
	}

	query += `)`;

	const result = await postgres.query(query, params);
	return result.rows[0].exists;
};

const isWithinHalfYear = (date: Date): boolean => {
	const now = new Date()
	const halfYearLater = new Date(now.getTime() + 26 * 7 * 24 * 60 * 60 * 1000) // 26 weeks later
	return date <= halfYearLater
}

// Helper function to round down the hour
const roundDownHour = (date: Date): number => {
	return date.getHours()
}

// Helper function to round up the hour
const roundUpHour = (date: Date): number => {
	const minutes = date.getMinutes()
	return minutes > 0 ? date.getHours() + 1 : date.getHours()
}

// Helper function to get the day ID (Monday = 0, Sunday = 6)
const getDayId = (date: Date): number => {
	const day = date.getDay() // 0 (Sunday) to 6 (Saturday)
	return day === 0 ? 6 : day - 1 // Convert to Monday=0, Sunday=6
}

// Helper function to generate keys for a schedule within the current week
const generateKeysForSchedule = (start: Date, end: Date, startOfWeek: Date, endOfWeek: Date): string[] => {
	const keys: string[] = []

	// Ensure the schedule is within the current week
	const scheduleStart = start < startOfWeek ? startOfWeek : start
	const scheduleEnd = end > endOfWeek ? endOfWeek : end

	// Round down the start hour and round up the end hour minus 1
	const startHour = roundDownHour(scheduleStart)
	const endHour = roundUpHour(new Date(scheduleEnd.getTime() - 1)) // Subtract 1 millisecond to avoid overlapping

	// Adjust the end hour by subtracting 1
	const adjustedEndHour = endHour - 1

	// Get the day ID for the schedule
	const startDayId = getDayId(scheduleStart)
	const endDayId = getDayId(scheduleEnd)

	// Generate keys for all hours between startHour and adjustedEndHour
	let currentHour = startHour
	let currentDayId = startDayId

	while (currentHour <= adjustedEndHour || currentDayId !== endDayId) {
		keys.push(`${currentHour}-${currentDayId}`)

		// Move to the next hour
		currentHour++
		if (currentHour > 23) {
			currentHour = 0
			currentDayId = (currentDayId + 1) % 7 // Move to the next day
		}
	}

	return keys
}

// Fetch schedules for a specific week and user
const fetchSchedulesForWeek = async (startOfWeek: Date, endOfWeek: Date, user: User, category?: number) => {
	let query = `
      SELECT s.*, u.name, u.avatar_url
      FROM schedule s
               JOIN "user" u ON s.user_id = u.id
      WHERE s.start <= $1
        AND s.end >= $2
	`
	const params: any[] = [endOfWeek.toISOString(), startOfWeek.toISOString()]

	// Add category filter if provided
	if (category === 1 || category === 2) {
		query += " AND s.category = $3"
		params.push(category)
	}

	// Add role-specific filters
	switch (Number(user.user_metadata.role)) {
		case UserRole.Owner:
		case UserRole.Leader:
			query += category ? " AND (s.company_id = $4 OR s.user_id = $5)"
				: " AND (s.company_id = $3 OR s.user_id = $4)"
			params.push(user.user_metadata.company_id, user.id)
			break
		case UserRole.Employee:
			query += category ? " AND s.user_id = $4"
				: " AND s.user_id = $3"
			params.push(user.id)
			break
		default:
			return []
	}

	query += " ORDER BY s.start"

	const result = await postgres.query(query, params)
	return result.rows.map(schedule => ({
		...schedule,
		start: new Date(schedule.start),
		end: new Date(schedule.end)
	}))
}

// Format the schedule response
const formatScheduleResponse = async (startOfWeek: Date, schedules: Schedule[], companyId: string) => {
	const scheduleCounts: Record<string, number> = {}

	schedules.forEach(schedule => {
		const start = new Date(schedule.start)
		const end = new Date(schedule.end)

		// Generate keys for the schedule within the current week
		const keys = generateKeysForSchedule(start, end, startOfWeek, getEndOfWeek(startOfWeek))

		// Increment the count for each key
		keys.forEach(key => {
			if (!scheduleCounts[key]) scheduleCounts[key] = 0
			scheduleCounts[key]++
		})
	})

	// Calculate next week's start (Monday 00:00:00)
	const nextWeekStart = getNextWeekStart(startOfWeek)
	const prevWeekStart = getPrevWeekStart(startOfWeek)

	// Check if there are any schedules before the current week for this company
	const hasPrevSchedules = await postgres.query(`
      SELECT EXISTS(SELECT 1
                    FROM schedule
                    WHERE "end" < $1
                      AND company_id = $2)
	`, [startOfWeek.toISOString(), companyId])

	return {
		weekStart: startOfWeek.toISOString().split("T")[0],
		prevDate: hasPrevSchedules.rows[0].exists
			? `${prevWeekStart.getFullYear()}-${String(prevWeekStart.getMonth() + 1).padStart(2, "0")}-${String(prevWeekStart.getDate()).padStart(2, "0")}`
			: null,
		nextDate: isWithinHalfYear(nextWeekStart)
			? `${nextWeekStart.getFullYear()}-${String(nextWeekStart.getMonth() + 1).padStart(2, "0")}-${String(nextWeekStart.getDate()).padStart(2, "0")}`
			: null,
		schedule: scheduleCounts
	}
}

// Helper function to validate and parse weekStart parameter
const parseWeekStartParam = (weekStart: unknown): Date | { error: ApiResponse } => {
	if (!weekStart || typeof weekStart !== "string") {
		return getStartOfWeek(new Date())
	}

	const splitDate = weekStart.split("-")
	if (splitDate.length !== 3) {
		return {
			error: {
				status: "error",
				message: "Invalid weekStart format. Use YYYY-MM-DD."
			}
		}
	}

	const dateInWeek = new Date(
		Number(splitDate[0]),
		Number(splitDate[1]) - 1,
		Number(splitDate[2])
	)

	if (isNaN(dateInWeek.getTime())) {
		return {
			error: {
				status: "error",
				message: "Invalid weekStart date."
			}
		}
	}

	return getStartOfWeek(dateInWeek)
}

// Utility function to check if a time falls within the restricted hours for users under 18
const isRestrictedTime = (start: Date, end: Date): boolean => {
	// Convert to Amsterdam time (handles both CET and CEST automatically)
	const amsterdamStart = new Date(start.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
	const amsterdamEnd = new Date(end.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));

	const startHour = amsterdamStart.getHours();
	const endHour = amsterdamEnd.getHours();

	// Restricted hours are 22:00-06:00 Amsterdam time (regardless of DST)
	const isStartRestricted = startHour >= 22 || startHour < 6;
	const isEndRestricted = endHour > 22 || endHour <= 6;
	const spansNight = startHour < 6 && endHour >= 22;

	return isStartRestricted || isEndRestricted || spansNight;
}

// Utility function to validate schedule constraints for a user
const validateScheduleConstraints = async (userId: string, start: Date, end: Date, scheduleId?: string) => {
	// Check for overlapping schedules
	if (await hasOverlappingSchedules(userId, start, end, scheduleId)) {
		throw {
			message: "A schedule already exists for this user in the specified timeframe.",
			code: 400
		}
	}

	// Fetch user age
	const userQuery = `
      SELECT age
      FROM "user"
      WHERE id = $1
	`
	const userResult = await postgres.query(userQuery, [userId])
	const userAge = userResult.rows[0]?.age

	if (userAge === undefined) {
		throw {
			message: "User not found.",
			code: 404
		}
	}

	// Check if the user is under 18 and the schedule falls within restricted hours
	if (userAge < 18 && isRestrictedTime(start, end)) {
		throw {
			message: "Users aged below 18 cannot work between 22-6 UTC+1 (21-5 UTC).",
			code: 400
		}
	}

	const scheduleDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

	// Fetch both previous and next schedules relative to the new schedule
	const adjacentSchedulesQuery = `
      SELECT "start", "end"
      FROM schedule
      WHERE user_id = $1
        AND (COALESCE($2, '') = '' OR id != $2::uuid)
      ORDER BY "start"
	`
	const adjacentSchedulesResult = await postgres.query(adjacentSchedulesQuery, [userId, scheduleId])
	const adjacentSchedules = adjacentSchedulesResult.rows.map(row => ({
		start: new Date(row.start),
		end: new Date(row.end)
	}))

	// Find the immediate previous and next schedules
	let previousSchedule: { start: Date, end: Date } | null = null
	let nextSchedule: { start: Date, end: Date } | null = null

	for (const schedule of adjacentSchedules) {
		if (schedule.end <= start) {
			previousSchedule = schedule
		} else if (schedule.start >= end) {
			nextSchedule = schedule
			break // We only need the first one after our schedule
		}
	}

	// Validate against previous schedule
	if (previousSchedule) {
		const timeAfterPreviousEnd = (start.getTime() - previousSchedule.end.getTime()) / (1000 * 60 * 60)

		if (userAge >= 18 && timeAfterPreviousEnd < 8) {
			throw {
				message: "A new schedule cannot start less than 8 hours after the previous schedule ends.",
				code: 400
			}
		}

		if (userAge < 18 && timeAfterPreviousEnd < 12) {
			throw {
				message: "For employees under 18, a new schedule cannot start less than 12 hours after the previous schedule ends.",
				code: 400
			}
		}
	}

	// Validate against next schedule
	if (nextSchedule) {
		const timeBeforeNextStart = (nextSchedule.start.getTime() - end.getTime()) / (1000 * 60 * 60)

		if (userAge >= 18 && timeBeforeNextStart < 8) {
			throw {
				message: "A new schedule cannot end less than 8 hours before the next schedule starts.",
				code: 400
			}
		}

		if (userAge < 18 && timeBeforeNextStart < 12) {
			throw {
				message: "For employees under 18, a new schedule cannot end less than 12 hours before the next schedule starts.",
				code: 400
			}
		}
	}

	// Validate maximum duration
	if (userAge >= 18) {
		if (scheduleDuration > 12) {
			throw {
				message: "Employees aged 18 or more cannot work more than 12 hours.",
				code: 400
			}
		}
	} else {
		if (scheduleDuration > 8) {
			throw {
				message: "Employees aged less than 18 cannot work more than 8 hours.",
				code: 400
			}
		}
	}
}

// Combined GET /schedule route (handles both with and without weekStart parameter)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { weekStart, category } = req.query

	try {
		if (!hasPermission(user, "schedule", "view", {
			user_id: user.id,
			company_id: user.user_metadata.company_id,
			finalized: true
		})) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to view schedules."
			} satisfies ApiResponse)
			return
		}

		// Validate category parameter if provided
		let categoryNumber: number | undefined
		if (category) {
			categoryNumber = Number(category)
			if (categoryNumber !== 1 && categoryNumber !== 2) {
				res.status(400).json({
					status: "error",
					message: "Invalid category parameter. Must be 1 or 2."
				} satisfies ApiResponse)
				return
			}
		}

		// Handle weekStart parameter using the helper function
		const weekStartResult = parseWeekStartParam(weekStart)
		if ("error" in weekStartResult) {
			res.status(400).json(weekStartResult.error)
			return
		}
		const startOfWeek: Date = weekStartResult

		const endOfWeek = getEndOfWeek(startOfWeek)
		const schedules = await fetchSchedulesForWeek(startOfWeek, endOfWeek, user, categoryNumber)

		const data = await formatScheduleResponse(startOfWeek, schedules, user.user_metadata.company_id)

		res.status(200).json({
			status: "ignore",
			message: "Schedules fetched successfully!",
			data
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /schedule/details/:hourDay (detailed schedules for a specific hour and day)
router.get("/details/:hourDay", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { hourDay } = req.params
	const [hour, day] = hourDay.split("-").map(Number)

	if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(day) || day < 0 || day > 6) {
		res.status(400).json({
			status: "error",
			message: "Invalid hour or day parameter. Hour must be between 0 and 23, and day must be between 0 and 6."
		} satisfies ApiResponse)
		return
	}

	// Handle weekStart parameter
	const weekStartResult = parseWeekStartParam(req.query.weekStart)
	if ("error" in weekStartResult) {
		res.status(400).json(weekStartResult.error)
		return
	}
	const startOfWeek: Date = weekStartResult

	const limit = req.query.limit ? Number(req.query.limit) : 20
	const page = req.query.page ? Number(req.query.page) : 1
	const offset = (page - 1) * limit

	try {
		const startOfDay = new Date(startOfWeek)
		startOfDay.setDate(startOfWeek.getDate() + day)
		startOfDay.setHours(hour, 0, 0, 0)
		const endOfDay = new Date(startOfDay)
		endOfDay.setHours(hour, 59, 59, 999)

		let schedulesQuery = `
        SELECT s.*, u.name, u.avatar_url
        FROM schedule s
                 JOIN "user" u ON s.user_id = u.id
        WHERE s.start <= $1
          AND $2 <= s.end
		`

		let countQuery = `
        SELECT COUNT(*) as total
        FROM schedule s
                 JOIN "user" u ON s.user_id = u.id
        WHERE s.start <= $1
          AND $2 <= s.end
		`

		let queryParams: any[] = [endOfDay.toISOString(), startOfDay.toISOString()]

		switch (Number(user.user_metadata.role)) {
			case UserRole.Owner:
			case UserRole.Leader:
				schedulesQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
				countQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
				queryParams.push(user.user_metadata.company_id, user.id)
				break
			case UserRole.Employee:
				schedulesQuery += " AND s.user_id = $3"
				countQuery += " AND s.user_id = $3"
				queryParams.push(user.id)
				break
			default:
				res.status(403).json({
					status: "error",
					message: "You do not have permission to view schedules."
				} satisfies ApiResponse)
				return
		}

		schedulesQuery += " ORDER BY s.start LIMIT $5 OFFSET $6"
		queryParams.push(limit, offset)

		const schedulesResult = await postgres.query(schedulesQuery, queryParams)
		const countResult = await postgres.query(countQuery, queryParams.slice(0, -2))

		const totalSchedules = Number(countResult.rows[0].total)
		const totalPages = Math.ceil(totalSchedules / limit)

		res.status(200)
			.set('Cache-Control', 'private, max-age=300')
			.json({
			status: "ignore",
			message: "Schedules fetched successfully!",
			data: {
				schedules: schedulesResult.rows.map(schedule => ({
					id: schedule.id,
					category: schedule.category,
					start: schedule.start.toISOString(),
					end: schedule.end.toISOString(),
					finalized: schedule.finalized,
					user: {
						name: schedule.name,
						avatarUrl: schedule.avatar_url
					}
				})),
				pagination: {
					totalPages,
					currentPage: page,
					limit,
					totalItems: totalSchedules
				}
			}
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Schema for validating the request body
const createScheduleSchema = object({
	start: string().datetime(),
	end: string().datetime(),
	category: number().min(1).max(2),
	company_id: string(),
	user_id: string().array().nonempty()
})

// POST /schedule (create a new schedule)
router.post("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const creator = req.user as User

	try {
		const validation = createScheduleSchema.safeParse(req.body)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid data! Please check the fields.",
				errors: validation.error.errors
			} satisfies ApiResponse)
			return
		}

		const { start, end, category, company_id, user_id } = validation.data

		const startDate = new Date(start)
		const endDate = new Date(end)
		startDate.setSeconds(0, 0)
		endDate.setSeconds(0, 0)

		// Ensure the schedule is at least 4 hours long
		const scheduleDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

		if (scheduleDuration < 4) {
			res.status(400).json({
				status: "error",
				message: "A schedule must be at least 4 hours long."
			} satisfies ApiResponse)
			return
		}

		if (!hasPermission(creator, "schedule", "create", { user_id: creator.id, company_id, finalized: true })) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to create schedules."
			} satisfies ApiResponse)
			return
		}

		if (creator.user_metadata.company_id !== company_id) {
			res.status(403).json({
				status: "error",
				message: "You are not authorized to create schedules for this company!"
			} satisfies ApiResponse)
			return
		}

		const errors: Array<{ userId: string; message: string; code: number }> = []

		for (const userId of user_id) {
			try {
				await validateScheduleConstraints(userId, new Date(start), new Date(end))

				const insertQuery = `
            INSERT INTO schedule (start, "end", category, user_id, company_id)
            VALUES ($1, $2, $3, $4, $5)
				`

				await postgres.query(insertQuery, [
					startDate.toISOString(),
					endDate.toISOString(),
					category,
					userId,
					company_id
				])
			} catch (error: any) {
				errors.push({
					userId: userId,
					message: error.message,
					code: error.code || 500
				})
			}
		}

		if (errors.length > 0) {
			console.log(errors)
			res.status(207).json({
				status: "error",
				message: "Some schedules could not be created.",
				data: errors
			} satisfies ApiResponse)
		} else {
			res.status(201).json({
				status: "success",
				message: "All schedules created successfully!"
			} satisfies ApiResponse)
		}
	} catch (error) {
		next(error)
	}
})

// GET /users (fetch users' data with schedules)
router.get("/users", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { name } = req.query

	const limit = req.query.limit ? Number(req.query.limit) : 20
	const page = req.query.page ? Number(req.query.page) : 1
	const offset = (page - 1) * limit

	try {
		if (!hasPermission(user, "schedule", "view", {
			user_id: user.id,
			company_id: user.user_metadata.company_id,
			finalized: true
		})) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to view users' data."
			} satisfies ApiResponse)
			return
		}

		// Base conditions
		const conditions = [`u.company_id = $1`]
		const baseParams: (string | number)[] = [user.user_metadata.company_id]

		if (name) {
			conditions.push(`u.name ILIKE $2`)
			baseParams.push(`%${name}%`)
		}

		// Get the paginated user IDs
		const userPaginationQuery = `
        SELECT u.id
        FROM "user" u
            ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        ORDER BY u.name
        LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
		`
		const paginationParams = [...baseParams, limit, offset]
		const paginatedUserIds = await postgres.query(
			userPaginationQuery,
			paginationParams
		)

		// If no users found, return empty result
		if (paginatedUserIds.rows.length === 0) {
			res.status(200)
				.set('Cache-Control', 'private, max-age=300')
				.json({
				status: "ignore",
				message: "No users found",
				data: {
					users: [],
					pagination: {
						totalPages: 0,
						currentPage: page,
						limit,
						totalItems: 0
					}
				}
			} satisfies ApiResponse)
			return
		}

		// Get complete data for the paginated users
		const userIds: string[] = paginatedUserIds.rows.map(row => row.id)
		const usersQuery = `
        SELECT u.id, u.name, u.avatar_url, s.start, s.end
        FROM "user" u
                 LEFT JOIN schedule s ON u.id = s.user_id
        WHERE u.id = ANY ($1)
        ORDER BY u.name, s.start
		`
		const usersResult = await postgres.query(
			usersQuery,
			[userIds]
		)

		// Get total count (for pagination)
		const countQuery = `
        SELECT COUNT(*) as total
        FROM "user" u
            ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
		`
		const countResult = await postgres.query(
			countQuery,
			baseParams
		)
		const totalUsers = Number(countResult.rows[0].total)
		const totalPages = Math.ceil(totalUsers / limit)

		// Format the response
		const users: Record<string, any> = {}
		usersResult.rows.forEach(row => {
			if (!users[row.id]) {
				users[row.id] = {
					id: row.id,
					name: row.name,
					avatarUrl: row.avatar_url,
					schedules: []
				}
			}

			if (row.start && row.end) {
				users[row.id].schedules.push({
					start: `${new Date(row.start).toLocaleDateString("en-US", { weekday: "long" })} - ${new Date(row.start).toString()}`,
					end: `${new Date(row.end).toLocaleDateString("en-US", { weekday: "long" })} - ${new Date(row.end).toString()}`
				})
			}
		})

		res.status(200)
			.set('Cache-Control', 'private, max-age=300')
			.json({
			status: "ignore",
			message: "Users' data fetched successfully!",
			data: {
				users: Object.values(users),
				pagination: {
					totalPages,
					currentPage: page,
					limit,
					totalItems: totalUsers
				}
			}
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Schema for validating the request body [finalization]
const finalizeScheduleSchema = object({
	scheduleIds: string().array().nonempty(),
	finalized: boolean()
})

// PATCH /schedule/finalize (finalize schedules)
router.patch("/finalize", getUserFromCookie, async (req: Request, res: Response, next) => {
	const creator = req.user as User

	try {
		const validation = finalizeScheduleSchema.safeParse(req.body)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid data! Please check the fields.",
				errors: validation.error.errors
			} satisfies ApiResponse)
			return
		}

		const { scheduleIds } = validation.data

		if (!hasPermission(creator, "schedule", "finalize", {
			user_id: creator.id,
			company_id: creator.user_metadata.company_id,
			finalized: true
		})) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to finalize schedules."
			} satisfies ApiResponse)
			return
		}

		const updateQuery = `
        UPDATE schedule
        SET finalized = true
        WHERE id = ANY ($1)
		`
		await postgres.query(updateQuery, [scheduleIds])

		res.status(200).json({
			status: "success",
			message: "Schedules finalized successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Schema for validating the request body
const deleteScheduleSchema = object({
	scheduleIds: string().array().nonempty()
})

// DELETE /schedule (delete schedules)
router.delete("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		const validation = deleteScheduleSchema.safeParse(req.body)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid data! Please check the fields.",
				errors: validation.error.errors
			} satisfies ApiResponse)
			return
		}

		const { scheduleIds } = validation.data

		const errors: Array<{ scheduleId: string; message: string; code: number }> = []

		const fetchSchedulesQuery = `
        SELECT id, finalized
        FROM schedule
        WHERE id = ANY ($1)
		`
		const fetchSchedulesResult = await postgres.query(fetchSchedulesQuery, [scheduleIds])

		const existingScheduleIds = fetchSchedulesResult.rows.map(row => row.id)
		const missingScheduleIds = scheduleIds.filter(id => !existingScheduleIds.includes(id))
		if (missingScheduleIds.length > 0) {
			for (const missingId of missingScheduleIds) {
				errors.push({
					scheduleId: missingId,
					message: "Schedule not found.",
					code: 404
				})
			}
		}

		for (const schedule of fetchSchedulesResult.rows) {
			if (schedule.finalized && !hasPermission(user, "schedule", "delete", {
				user_id: user.id,
				company_id: user.user_metadata.company_id,
				finalized: true
			})) {
				errors.push({
					scheduleId: schedule.id,
					message: "You do not have permission to delete a finalized schedule.",
					code: 403
				})
			} else if (!hasPermission(user, "schedule", "delete", {
				user_id: user.id,
				company_id: user.user_metadata.company_id,
				finalized: false
			})) {
				errors.push({
					scheduleId: schedule.id,
					message: "You do not have permission to delete this schedule.",
					code: 403
				})
			}
		}

		if (errors.length > 0) {
			res.status(207).json({
				status: "error",
				message: "Some schedules could not be deleted.",
				data: errors
			} satisfies ApiResponse)
			return
		}

		const deleteQuery = `
        DELETE
        FROM schedule
        WHERE id = ANY ($1)
		`
		await postgres.query(deleteQuery, [scheduleIds])

		res.status(200).json({
			status: "success",
			message: "Schedules deleted successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Schema for validating the request body for schedule modification
const updateScheduleSchema = object({
	start: string().datetime(),
	end: string().datetime()
})

// PATCH /schedule/update/:id (modify an existing schedule)
router.patch("/update/:id", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const scheduleId = req.params.id

	try {
		const validation = updateScheduleSchema.safeParse(req.body)
		if (!validation.success) {
			res.status(400).json({
				status: "error",
				message: "Invalid data! Please check the fields.",
				errors: validation.error.errors
			} satisfies ApiResponse)
			return
		}

		const { start, end } = validation.data

		const fetchScheduleQuery = `
        SELECT id, user_id, company_id, finalized
        FROM schedule
        WHERE id = $1
		`
		const fetchScheduleResult = await postgres.query(fetchScheduleQuery, [scheduleId])

		if (fetchScheduleResult.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Schedule not found."
			} satisfies ApiResponse)
			return
		}

		const schedule = fetchScheduleResult.rows[0]

		if (!hasPermission(user, "schedule", "update", {
			user_id: schedule.user_id,
			company_id: schedule.company_id,
			finalized: schedule.finalized
		})) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to modify this schedule."
			} satisfies ApiResponse)
			return
		}

		await validateScheduleConstraints(schedule.user_id, new Date(start), new Date(end), scheduleId)

		const updateQuery = `
        UPDATE schedule
        SET start = $1,
            "end" = $2
        WHERE id = $3
		`
		await postgres.query(updateQuery, [
			new Date(start).toISOString(),
			new Date(end).toISOString(),
			scheduleId
		])

		res.status(200).json({
			status: "success",
			message: "Schedule updated successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

export default router