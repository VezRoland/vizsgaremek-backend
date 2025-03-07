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

// Utility function to fetch schedules for a given week
const fetchSchedulesForWeek = async (startOfWeek: Date, endOfWeek: Date) => {
	const schedulesQuery = `
      SELECT s.*, u.name--, u.avatar_url
      FROM schedule s
               JOIN "user" u ON s.user_id = u.id
      WHERE s.start >= $1
        AND s.end <= $2
      ORDER BY s.start
	`
	const schedulesResult = await postgres.query(schedulesQuery, [startOfWeek, endOfWeek])
	return schedulesResult.rows
}

// Utility function to format the response
const formatScheduleResponse = (startOfWeek: Date, schedules: any[], hasPrevWeekSchedules: boolean, hasNextWeekSchedules: boolean) => {
	return {
		[`${startOfWeek.getMonth() + 1}-${startOfWeek.getDate()}`]: schedules.map(schedule => ({
			id: schedule.id,
			category: schedule.category,
			start: schedule.start.toISOString(),
			end: schedule.end.toISOString(),
			user: {
				name: schedule.name,
				avatar_url: schedule.avatar_url
			}
		})),
		prevDate: hasPrevWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000)).getTime() : null,
		nextDate: hasNextWeekSchedules ? getStartOfWeek(new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)).getTime() : null
	}
}

// GET /schedule (current week)
router.get("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		const now = new Date()
		const startOfCurrentWeek = getStartOfWeek(now)
		const endOfCurrentWeek = getEndOfWeek(now)

		// Fetch schedules for the current week
		const schedules = await fetchSchedulesForWeek(startOfCurrentWeek, endOfCurrentWeek)

		// Check for schedules in the previous and next weeks
		const startOfPrevWeek = new Date(startOfCurrentWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
		const endOfPrevWeek = new Date(startOfPrevWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasPrevWeekSchedules = await hasSchedulesInWeek(startOfPrevWeek, endOfPrevWeek)

		const startOfNextWeek = new Date(startOfCurrentWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
		const endOfNextWeek = new Date(startOfNextWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasNextWeekSchedules = await hasSchedulesInWeek(startOfNextWeek, endOfNextWeek)

		// Format the response
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
		const startOfSpecifiedWeek = new Date(weekStartMillis)
		const endOfSpecifiedWeek = getEndOfWeek(startOfSpecifiedWeek)

		// Fetch schedules for the specified week
		const schedules = await fetchSchedulesForWeek(startOfSpecifiedWeek, endOfSpecifiedWeek)

		// Check for schedules in the previous and next weeks
		const startOfPrevWeek = new Date(startOfSpecifiedWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
		const endOfPrevWeek = new Date(startOfPrevWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasPrevWeekSchedules = await hasSchedulesInWeek(startOfPrevWeek, endOfPrevWeek)

		const startOfNextWeek = new Date(startOfSpecifiedWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
		const endOfNextWeek = new Date(startOfNextWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
		const hasNextWeekSchedules = await hasSchedulesInWeek(startOfNextWeek, endOfNextWeek)

		// Format the response
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

export default router