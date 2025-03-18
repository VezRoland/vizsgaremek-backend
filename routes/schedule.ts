import { Router, type Request, type Response } from "express"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ApiResponse } from "../types/response.ts"
import type { User } from "@supabase/supabase-js"
import { hasPermission } from "../lib/roles"
import { UserRole } from "../types/database.ts"
import { object, string, number } from "zod"


const router = Router()

// Utility function to get the start of the week (Monday)
const getStartOfWeek = (date: Date): Date => {
	const day = date.getDay()
	const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
	const startOfWeek = new Date(date)
	startOfWeek.setDate(diff)
	startOfWeek.setUTCHours(0, 0, 0, 0) // Explicitly set time to 00:00:00.000
	return startOfWeek
}

// Utility function to get the end of the week (Sunday)
const getEndOfWeek = (date: Date): Date => {
	const startOfWeek = getStartOfWeek(date)
	const endOfWeek = new Date(startOfWeek)
	endOfWeek.setDate(startOfWeek.getDate() + 6)
	endOfWeek.setUTCHours(23, 59, 59, 999) // Set time to the end of the day
	return endOfWeek
}

// Utility function to check if there are schedules in a given week
const hasSchedulesInWeek = async (startOfWeek: Date, endOfWeek: Date): Promise<boolean> => {
	const query = `
      SELECT EXISTS(SELECT 1
                    FROM schedule
                    WHERE schedule.start >= $1
                      AND schedule.end <= $2)
	`
	const result = await postgres.query(query, [startOfWeek, endOfWeek])
	return result.rows[0].exists
}

const fetchSchedulesForWeek = async (startOfWeek: Date, endOfWeek: Date, user: User) => {
	let schedulesQuery = `
      SELECT s.*, u.name, u.avatar_url
      FROM schedule s
               JOIN "user" u ON s.user_id = u.id
      WHERE s.start >= $1
        AND s.end <= $2
	`

	let queryParams: any[] = [startOfWeek, endOfWeek]

	// Add role-specific filters
	switch (Number(user.user_metadata.role)) {
		case UserRole.Owner:
		case UserRole.Leader:
			// Owners and Leaders can view schedules for their company or their own schedules
			schedulesQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
			queryParams.push(user.user_metadata.company_id, user.id)
			break
		case UserRole.Employee:
			// Employees can only view their own schedules
			schedulesQuery += " AND s.user_id = $3"
			queryParams.push(user.id)
			break
		default:
			// No permissions + Admin
			return []
	}

	schedulesQuery += " ORDER BY s.start"

	const schedulesResult = await postgres.query(schedulesQuery, queryParams)
	return schedulesResult.rows
}

// Utility function to format the response
const formatScheduleResponse = (startOfWeek: Date, schedules: any[], hasPrevWeekSchedules: boolean, hasNextWeekSchedules: boolean) => {
	// Group schedules by hour and day
	const scheduleCounts: Record<string, number> = {}
	schedules.forEach(schedule => {
		const start = new Date(schedule.start)
		const hour = start.getUTCHours() // Use UTC hours
		const day = start.getUTCDay() // 0 (Sunday) to 6 (Saturday)
		const key = `${hour}-${day}`

		if (!scheduleCounts[key]) scheduleCounts[key] = 0
		scheduleCounts[key]++
	})

	return {
		week_start: startOfWeek.toISOString().split("T")[0], // Format as YYYY-MM-DD
		prevDate: hasPrevWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000)).getTime() : null,
		nextDate: hasNextWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)).getTime() : null,
		schedule: scheduleCounts
	}
}

// GET /schedule (current week)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		// Check if the user has permission to view schedules
		if (!hasPermission(user, "schedule", "view", { user_id: user.id, company_id: user.user_metadata.company_id })) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to view schedules."
			} satisfies ApiResponse)
			return
		}

		const now = new Date()
		const startOfCurrentWeek = getStartOfWeek(now)
		const endOfCurrentWeek = getEndOfWeek(now)

		// Fetch schedules for the current week
		const schedules = await fetchSchedulesForWeek(startOfCurrentWeek, endOfCurrentWeek, user)

		// Check for schedules in the previous and next weeks
		const startOfPrevWeek = new Date(startOfCurrentWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
		const endOfPrevWeek = new Date(startOfPrevWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasPrevWeekSchedules = await hasSchedulesInWeek(startOfPrevWeek, endOfPrevWeek)

		const startOfNextWeek = new Date(startOfCurrentWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
		const endOfNextWeek = new Date(startOfNextWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasNextWeekSchedules = await hasSchedulesInWeek(startOfNextWeek, endOfNextWeek)

		const data = formatScheduleResponse(startOfCurrentWeek, schedules, hasPrevWeekSchedules, hasNextWeekSchedules)

		res.json({
			status: "success",
			message: "Schedules fetched successfully!",
			data
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /schedule/:weekStart (specific week)
router.get("/:weekStart", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const weekStartMillis = Number(req.params.weekStart)

	if (isNaN(weekStartMillis)) {
		res.status(400).json({
			status: "error",
			message: "Invalid weekStart parameter. It must be a valid timestamp in milliseconds."
		} satisfies ApiResponse)
		return
	}

	try {
		// Check if the user has permission to view schedules
		if (!hasPermission(user, "schedule", "view", { user_id: user.id, company_id: user.user_metadata.company_id })) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to view schedules."
			} satisfies ApiResponse)
			return
		}

		const startOfSpecifiedWeek = new Date(weekStartMillis)
		const endOfSpecifiedWeek = getEndOfWeek(startOfSpecifiedWeek)

		// Fetch schedules for the specified week
		const schedules = await fetchSchedulesForWeek(startOfSpecifiedWeek, endOfSpecifiedWeek, user)

		// Check for schedules in the previous and next weeks
		const startOfPrevWeek = new Date(startOfSpecifiedWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
		const endOfPrevWeek = new Date(startOfPrevWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasPrevWeekSchedules = await hasSchedulesInWeek(startOfPrevWeek, endOfPrevWeek)

		const startOfNextWeek = new Date(startOfSpecifiedWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
		const endOfNextWeek = new Date(startOfNextWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasNextWeekSchedules = await hasSchedulesInWeek(startOfNextWeek, endOfNextWeek)

		const data = formatScheduleResponse(startOfSpecifiedWeek, schedules, hasPrevWeekSchedules, hasNextWeekSchedules)

		res.json({
			status: "success",
			message: "Schedules fetched successfully!",
			data
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// GET /schedule/:hour-day (detailed schedules for a specific hour and day)
router.get("/details/:hourDay", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { hourDay } = req.params
	const [hour, day] = hourDay.split("-").map(Number)

	// Validate hour and day
	if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(day) || day < 0 || day > 6) {
		res.status(400).json({
			status: "error",
			message: "Invalid hour or day parameter. Hour must be between 0 and 23, and day must be between 0 and 6."
		} satisfies ApiResponse)
		return
	}

	// Parse week_start query parameter
	let startOfWeek: Date
	if (req.query.week_start) {
		// Use the provided week_start
		startOfWeek = new Date(req.query.week_start as string)
		if (isNaN(startOfWeek.getTime())) {
			res.status(400).json({
				status: "error",
				message: "Invalid week_start parameter. It must be a valid date in the format YYYY-MM-DD."
			} satisfies ApiResponse)
			return
		}
	} else {
		// Use the current week
		startOfWeek = getStartOfWeek(new Date())
	}

	// Pagination parameters
	const limit = req.query.limit ? Number(req.query.limit) : 20
	const page = req.query.page ? Number(req.query.page) : 1
	const offset = (page - 1) * limit

	try {
		// Calculate the start and end of the specified hour and day
		const startOfDay = new Date(startOfWeek)
		startOfDay.setDate(startOfWeek.getDate() + day)
		startOfDay.setUTCHours(hour, 0, 0, 0) // Start of the hour
		const endOfDay = new Date(startOfDay)
		endOfDay.setUTCHours(hour, 59, 59, 999) // End of the hour

		let schedulesQuery = `
        SELECT s.*, u.name, u.avatar_url
        FROM schedule s
                 JOIN "user" u ON s.user_id = u.id
        WHERE s.start <= $1
          AND $2 <= s.end
		`

		let queryParams: any[] = [startOfDay, endOfDay]

		// Add role-specific filters
		switch (Number(user.user_metadata.role)) {
			case UserRole.Owner:
			case UserRole.Leader:
				// Owners and Leaders can view schedules for their company or their own schedules
				schedulesQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
				queryParams.push(user.user_metadata.company_id, user.id)
				break
			case UserRole.Employee:
				// Employees can only view their own schedules
				schedulesQuery += " AND s.user_id = $3"
				queryParams.push(user.id)
				break
			default:
				// No permissions + Admin
				res.status(403).json({
					status: "error",
					message: "You do not have permission to view schedules."
				} satisfies ApiResponse)
				return
		}

		schedulesQuery += " ORDER BY s.start LIMIT $5 OFFSET $6"
		queryParams.push(limit, offset)

		const schedulesResult = await postgres.query(schedulesQuery, queryParams)
		const schedules = schedulesResult.rows

		res.json({
			status: "success",
			message: "Schedules fetched successfully!",
			data: schedules.map(schedule => ({
				id: schedule.id,
				category: schedule.category,
				start: schedule.start.toISOString(),
				end: schedule.end.toISOString(),
				user: {
					name: schedule.name,
					avatar_url: schedule.avatar_url
				}
			}))
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Schema for validating the request body
const createScheduleSchema = object({
	start: string().datetime(),
	end: string().datetime(),
	category: number().min(1).max(2), // 1 = Paid, 2 = Unpaid
	company_id: string(),
	user_id: string().array().nonempty()
})

// POST /schedule (create a new schedule)
router.post("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const creator = req.user as User

	try {
		// Validate the request body
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

		// Check if the creator has permission to create schedules
		if (!hasPermission(creator, "schedule", "create", { user_id: creator.id, company_id })) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to create schedules."
			} satisfies ApiResponse)
			return
		}

		// Validate company_id based on the creator's role
		if (creator.user_metadata.company_id !== company_id) {
			res.status(403).json({
				status: "error",
				message: "You are not authorized to create schedules for this company!"
			} satisfies ApiResponse)
			return
		}

		// Array to store errors for individual users
		const errors: Array<{ user_id: string; message: string; code: number }> = []

		// Process each user in the user_id array
		for (const userId of user_id) {
			try {
				// Check for overlapping schedules for the subject user
				const overlapQuery = `
            SELECT EXISTS(SELECT 1
                          FROM schedule
                          WHERE user_id = $1
                            AND (
                              (start <= $2 AND $3 <= "end") OR
                              (start <= $4 AND $5 <= "end") OR
                              ($2 <= start AND "end" <= $4)
                              ))
				`
				const overlapResult = await postgres.query(overlapQuery, [
					userId,
					new Date(start).toISOString(),
					new Date(start).toISOString(),
					new Date(end).toISOString(),
					new Date(end).toISOString()
				])

				if (overlapResult.rows[0].exists) {
					throw {
						message: "A schedule already exists for this user in the specified timeframe.",
						code: 400
					}
				}

				// Fetch the subject user's age
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

				// Fetch the last schedule for the subject user
				const lastScheduleQuery = `
                  SELECT "end"
                  FROM schedule
                  WHERE user_id = $1
                  ORDER BY "end" DESC
                  LIMIT 1
				`
				const lastScheduleResult = await postgres.query(lastScheduleQuery, [userId])
				const lastScheduleEnd = lastScheduleResult.rows[0]?.end

				// Calculate the duration of the new schedule in hours
				const scheduleDuration = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)

				// Check age-based constraints
				if (userAge >= 18) {
					// Employees aged 18 or more
					if (scheduleDuration > 12) {
						throw {
							message: "Employees aged 18 or more cannot work more than 12 hours.",
							code: 400
						}
					}

					if (lastScheduleEnd) {
						const timeSinceLastSchedule = (new Date(start).getTime() - new Date(lastScheduleEnd).getTime()) / (1000 * 60 * 60)
						if (timeSinceLastSchedule < 8) {
							throw {
								message: "A new schedule cannot be created less than 8 hours after the last one's end.",
								code: 400
							}
						}
					}
				} else {
					// Employees aged less than 18
					if (scheduleDuration > 8) {
						throw {
							message: "Employees aged less than 18 cannot work more than 8 hours.",
							code: 400
						}
					}

					if (lastScheduleEnd) {
						const timeSinceLastSchedule = (new Date(start).getTime() - new Date(lastScheduleEnd).getTime()) / (1000 * 60 * 60)
						if (timeSinceLastSchedule < 12) {
							throw {
								message: "A new schedule cannot be created less than 12 hours after the last one's end.",
								code: 400
							}
						}
					}
				}

				// Insert the new schedule into the database
				const insertQuery = `
                  INSERT INTO schedule (start, "end", category, user_id, company_id)
                  VALUES ($1, $2, $3, $4, $5)
				`
				await postgres.query(insertQuery, [
					new Date(start).toISOString(),
					new Date(end).toISOString(),
					category,
					userId,
					company_id
				])
			} catch (error: any) {
				// Save the error for this user
				errors.push({
					user_id: userId,
					message: error.message,
					code: error.code || 500
				})
			}
		}

		// If there are errors, return them in the response
		if (errors.length > 0) {
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

	// Pagination parameters
	const limit = req.query.limit ? Number(req.query.limit) : 20
	const page = req.query.page ? Number(req.query.page) : 1
	const offset = (page - 1) * limit

	try {
		// Check if the user has permission to view users' data
		if (!hasPermission(user, "schedule", "view", { user_id: user.id, company_id: user.user_metadata.company_id })) {
			res.status(403).json({
				status: "error",
				message: "You do not have permission to view users' data."
			} satisfies ApiResponse)
			return
		}

		// Fetch users' data with schedules
		const usersQuery = `
        SELECT u.id, u.name, u.avatar_url, s.start, s."end"
        FROM "user" u
                 LEFT JOIN schedule s ON u.id = s.user_id
        WHERE u.name ILIKE $1
          AND u.company_id = $2
        ORDER BY u.name
        LIMIT $3 OFFSET $4
		`
		const usersResult = await postgres.query(usersQuery, [
			`%${name}%`, // Partial name match
			user.user_metadata.company_id, // Filter by company
			limit,
			offset
		])

		// Group schedules by user
		const users: Record<string, any> = {}
		usersResult.rows.forEach(row => {
			if (!users[row.id]) {
				users[row.id] = {
					id: row.id,
					name: row.name,
					avatar_url: row.avatar_url,
					schedules: []
				}
			}

			if (row.start && row.end) {
				users[row.id].schedules.push({
					start: `${new Date(row.start).toLocaleDateString("en-US", { weekday: "long" })} - ${new Date(row.start).toISOString()}`,
					end: `${new Date(row.end).toLocaleDateString("en-US", { weekday: "long" })} - ${new Date(row.end).toISOString()}`
				})
			}
		})

		res.json({
			status: "success",
			message: "Users' data fetched successfully!",
			data: Object.values(users)
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

export default router