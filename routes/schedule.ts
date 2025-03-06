import { Router, type Request, type Response } from "express"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ApiResponse } from "../types/response.ts"
import type { User } from "@supabase/supabase-js"

const router = Router()

// Utility function to get the start of the week (Monday)
const getStartOfWeek = (date: Date): Date => {
	const day = date.getDay()
	const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
	return new Date(date.setDate(diff))
}

// Utility function to get the end of the week (Sunday)
const getEndOfWeek = (date: Date): Date => {
	const startOfWeek = getStartOfWeek(date)
	const endOfWeek = new Date(startOfWeek)
	endOfWeek.setDate(startOfWeek.getDate() + 6)
	return endOfWeek
}

// Utility function to check if there are schedules in a given week
const hasSchedulesInWeek = async (startOfWeek: Date, endOfWeek: Date): Promise<boolean> => {
	const query = `
      SELECT EXISTS(
                 SELECT 1
                 FROM schedule
                 WHERE schedule.start >= $1
                   AND schedule.end <= $2
             )
	`
	const result = await postgres.query(query, [startOfWeek, endOfWeek])
	return result.rows[0].exists
}

// Utility function to get the Monday of a given week in milliseconds
const getMondayInMilliseconds = (date: Date): number => {
	const monday = getStartOfWeek(date)
	return monday.getTime()
}

// GET /schedule
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		const now = new Date()
		const startOfCurrentWeek = getStartOfWeek(now)
		const endOfCurrentWeek = getEndOfWeek(now)

		// Fetch schedules for the current week
		const schedulesQuery = `
          SELECT s.*, u.name--, u.avatar_url
          FROM schedule s
                   JOIN "user" u ON s.user_id = u.id
          WHERE s.start >= $1
            AND s.end <= $2
          ORDER BY s.start
		`
		const schedulesResult = await postgres.query(schedulesQuery, [startOfCurrentWeek, endOfCurrentWeek])
		const schedules = schedulesResult.rows

		// Check for schedules in the previous week
		const startOfPrevWeek = new Date(startOfCurrentWeek)
		startOfPrevWeek.setDate(startOfCurrentWeek.getDate() - 7)
		const endOfPrevWeek = new Date(startOfPrevWeek)
		endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6)
		const hasPrevWeekSchedules = await hasSchedulesInWeek(startOfPrevWeek, endOfPrevWeek)

		// Check for schedules in the next week
		const startOfNextWeek = new Date(startOfCurrentWeek)
		startOfNextWeek.setDate(startOfCurrentWeek.getDate() + 7)
		const endOfNextWeek = new Date(startOfNextWeek)
		endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
		const hasNextWeekSchedules = await hasSchedulesInWeek(startOfNextWeek, endOfNextWeek)

		// Format the response
		const data = {
			[`${startOfCurrentWeek.getMonth() + 1}-${startOfCurrentWeek.getDate()}`]: schedules.map(schedule => ({
				id: schedule.id,
				category: schedule.category,
				start: schedule.start.toISOString(),
				end: schedule.end.toISOString(),
				user: {
					name: schedule.name,
					avatar_url: schedule.avatar_url
				}
			})),
			prevDate: hasPrevWeekSchedules ? getMondayInMilliseconds(startOfPrevWeek) : null,
			nextDate: hasNextWeekSchedules ? getMondayInMilliseconds(startOfNextWeek) : null
		}

		res.json({
			status: "success",
			message: "Schedules fetched successfully!",
			data
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

export default router