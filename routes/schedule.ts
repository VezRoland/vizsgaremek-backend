import { Router, type Request, type Response } from "express"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ApiResponse } from "../types/response"
import type { User } from "@supabase/supabase-js"
import { hasPermission } from "../lib/roles"
import { UserRole } from "../types/database"
import { object, string, number, boolean } from "zod"

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
                    WHERE start >= $1
                      AND "end" <= $2)
	`
	const result = await postgres.query(query, [startOfWeek, endOfWeek])
	return result.rows[0].exists
}

// Utility function to check for overlapping schedules
const hasOverlappingSchedules = async (userId: string, start: Date, end: Date, excludeScheduleId?: string): Promise<boolean> => {
	const query = `
      SELECT EXISTS(SELECT 1
                    FROM schedule
                    WHERE user_id = $1
                      AND id != $2
                      AND (
                        (start <= $3 AND $4 <= "end") OR
                        (start <= $5 AND $6 <= "end") OR
                        ($3 <= start AND "end" <= $5)
                        ))
	`
	const result = await postgres.query(query, [
		userId,
		excludeScheduleId || null,
		start.toISOString(),
		start.toISOString(),
		end.toISOString(),
		end.toISOString()
	])
	return result.rows[0].exists
}

// Fetch schedules for a specific week and user
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
			schedulesQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
			queryParams.push(user.user_metadata.company_id, user.id)
			break
		case UserRole.Employee:
			schedulesQuery += " AND s.user_id = $3"
			queryParams.push(user.id)
			break
		default:
			return []
	}

	schedulesQuery += " ORDER BY s.start"

	const schedulesResult = await postgres.query(schedulesQuery, queryParams)
	return schedulesResult.rows
}

// Format the schedule response
const formatScheduleResponse = (startOfWeek: Date, schedules: any[], hasPrevWeekSchedules: boolean, hasNextWeekSchedules: boolean) => {
	const scheduleCounts: Record<string, number> = {}
	schedules.forEach(schedule => {
		const start = new Date(schedule.start)
		const hour = start.getUTCHours()
		const day = start.getUTCDay()
		const key = `${hour}-${day}`

		if (!scheduleCounts[key]) scheduleCounts[key] = 0
		scheduleCounts[key]++
	})

	return {
		week_start: startOfWeek.toISOString().split("T")[0],
		prevDate: hasPrevWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000)).getTime() : null,
		nextDate: hasNextWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)).getTime() : null,
		schedule: scheduleCounts
	}
}

// GET /schedule (current week)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

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

		const now = new Date()
		const startOfCurrentWeek = getStartOfWeek(now)
		const endOfCurrentWeek = getEndOfWeek(now)

		const schedules = await fetchSchedulesForWeek(startOfCurrentWeek, endOfCurrentWeek, user)

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
router.get("/weekStart/:weekStart", getUserFromCookie, async (req: Request, res: Response, next) => {
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

		const startOfSpecifiedWeek = new Date(weekStartMillis)
		const endOfSpecifiedWeek = getEndOfWeek(startOfSpecifiedWeek)

		const schedules = await fetchSchedulesForWeek(startOfSpecifiedWeek, endOfSpecifiedWeek, user)

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

	let startOfWeek: Date
	if (req.query.week_start) {
		startOfWeek = new Date(req.query.week_start as string)
		if (isNaN(startOfWeek.getTime())) {
			res.status(400).json({
				status: "error",
				message: "Invalid week_start parameter. It must be a valid date in the format YYYY-MM-DD."
			} satisfies ApiResponse)
			return
		}
	} else {
		startOfWeek = getStartOfWeek(new Date())
	}

	const limit = req.query.limit ? Number(req.query.limit) : 20
	const page = req.query.page ? Number(req.query.page) : 1
	const offset = (page - 1) * limit

	try {
		const startOfDay = new Date(startOfWeek)
		startOfDay.setDate(startOfWeek.getDate() + day)
		startOfDay.setUTCHours(hour, 0, 0, 0)
		const endOfDay = new Date(startOfDay)
		endOfDay.setUTCHours(hour, 59, 59, 999)

		let schedulesQuery = `
        SELECT s.*, u.name, u.avatar_url
        FROM schedule s
                 JOIN "user" u ON s.user_id = u.id
        WHERE s.start <= $1
          AND $2 <= s.end
		`

		let queryParams: any[] = [startOfDay, endOfDay]

		switch (Number(user.user_metadata.role)) {
			case UserRole.Owner:
			case UserRole.Leader:
				schedulesQuery += " AND (s.company_id = $3 OR s.user_id = $4)"
				queryParams.push(user.user_metadata.company_id, user.id)
				break
			case UserRole.Employee:
				schedulesQuery += " AND s.user_id = $3"
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

		const errors: Array<{ user_id: string; message: string; code: number }> = []

		for (const userId of user_id) {
			try {
				if (await hasOverlappingSchedules(userId, new Date(start), new Date(end))) {
					throw {
						message: "A schedule already exists for this user in the specified timeframe.",
						code: 400
					}
				}

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

				const lastScheduleQuery = `
            SELECT "end"
            FROM schedule
            WHERE user_id = $1
            ORDER BY "end" DESC
            LIMIT 1
				`
				const lastScheduleResult = await postgres.query(lastScheduleQuery, [userId])
				const lastScheduleEnd = lastScheduleResult.rows[0]?.end

				const scheduleDuration = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)

				if (userAge >= 18) {
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
				errors.push({
					user_id: userId,
					message: error.message,
					code: error.code || 500
				})
			}
		}

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
			`%${name}%`,
			user.user_metadata.company_id,
			limit,
			offset
		])

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

// Schema for validating the request body [finalization]
const finalizeScheduleSchema = object({
	schedule_ids: string().array().nonempty(),
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

		const { schedule_ids } = validation.data

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
		await postgres.query(updateQuery, [schedule_ids])

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
	schedule_ids: string().array().nonempty()
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

		const { schedule_ids } = validation.data

		const errors: Array<{ schedule_id: string; message: string; code: number }> = []

		const fetchSchedulesQuery = `
        SELECT id, finalized
        FROM schedule
        WHERE id = ANY ($1)
		`
		const fetchSchedulesResult = await postgres.query(fetchSchedulesQuery, [schedule_ids])

		const existingScheduleIds = fetchSchedulesResult.rows.map(row => row.id)
		const missingScheduleIds = schedule_ids.filter(id => !existingScheduleIds.includes(id))
		if (missingScheduleIds.length > 0) {
			for (const missingId of missingScheduleIds) {
				errors.push({
					schedule_id: missingId,
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
					schedule_id: schedule.id,
					message: "You do not have permission to delete a finalized schedule.",
					code: 403
				})
			} else if (!hasPermission(user, "schedule", "delete", {
				user_id: user.id,
				company_id: user.user_metadata.company_id,
				finalized: false
			})) {
				errors.push({
					schedule_id: schedule.id,
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
		await postgres.query(deleteQuery, [schedule_ids])

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

// PATCH /schedule/:id (modify an existing schedule)
router.patch("/:id", getUserFromCookie, async (req: Request, res: Response, next) => {
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
			} satisfies ApiResponse);
			return;
		}

		if (await hasOverlappingSchedules(schedule.user_id, new Date(start), new Date(end), scheduleId)) {
			res.status(400).json({
				status: "error",
				message: "A schedule already exists for this user in the specified timeframe."
			} satisfies ApiResponse)
			return
		}

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