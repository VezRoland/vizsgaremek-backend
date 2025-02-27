import { Router, type Request, type Response } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ServerResponse } from "../lib/types/response"
import { hasPermission } from "../lib/roles"
import type { User } from "@supabase/supabase-js"

const router = Router()

// Utility function to handle database errors
const handleDatabaseError = (res: Response, error: any) => {
	console.error("Database error:", error)
	res.status(500).json({
		error: true,
		type: "message",
		messageType: "error",
		message: "Adatbázis hiba történt!"
	} satisfies ServerResponse)
}

// Utility function to validate user authentication
const validateUser = (user: any, res: Response): boolean => {
	if (!user) {
		res.status(401).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs bejelentkezve!"
		} satisfies ServerResponse)
		return false
	}
	return true
}

// Utility function to validate request body
const validateRequestBody = (schema: any, body: any, res: Response): any | null => {
	const validation = schema.safeParse(body)
	if (!validation.success) {
		res.status(400).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Hibás adatok! Kérlek, ellenőrizd a mezőket."
		} satisfies ServerResponse)
		return null
	}
	return validation.data
}

// Utility function to fetch ticket details
const fetchTicketDetails = async (ticketId: number, user: any) => {
	const ticketQuery = "SELECT * FROM ticket WHERE id = $1"
	const ticketResult = await postgres.query(ticketQuery, [ticketId])
	const ticket = ticketResult.rows[0]

	if (!ticket) return null

	// Check if the user has permission to view the ticket
	if (!hasPermission(user, "tickets", "view", ticket)) {
		return null
	}

	return ticket
}

// Create new ticket
router.post("/ticket", getUserFromCookie, async (req: Request, res: Response) => {
	const schema = object({ title: string().min(3), content: string().min(10) })
	const user = req.user as User

	if (!validateUser(user, res)) return

	const data = validateRequestBody(schema, req.body, res)
	if (!data) return

	const { title, content } = data

	// Check if the user has permission to create a ticket
	if (!hasPermission(user, "tickets", "create")) {
		res.status(403).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs jogosultsága hibajegy létrehozásához!"
		} satisfies ServerResponse)
		return
	}

	try {
		await postgres.connect()
		const result = await postgres.query(
			"INSERT INTO ticket (title, content, user_id) VALUES ($1, $2, $3)",
			[title, content, user.id]
		)
		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres hibajegy létrehozás!",
		} satisfies ServerResponse)
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Get all tickets
router.get("/tickets", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user as User

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()

		let query = "SELECT * FROM ticket"
		const params: any[] = []

		// Add role-specific filters to the query
		switch (user.user_metadata.role) {
			case "admin":
				query += " WHERE company_id IS NULL" // Admins can only view tickets without a company
				break
			case "owner":
			case "leader":
				query += " WHERE user_id = $1 OR company_id = $2" // Owners and leaders can view their own or their company's tickets
				params.push(user.id, user.user_metadata.company_id)
				break
			case "employee":
				query += " WHERE user_id = $1" // Employees can only view their own tickets
				params.push(user.id)
				break
			default:
				res.status(403).json({
					error: true,
					type: "message",
					messageType: "error",
					message: "Nincs jogosultsága a hibajegyek megtekintéséhez!",
				} satisfies ServerResponse)
				return
		}

		const result = await postgres.query(query, params)

		if (result.rows.length === 0) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegyek nem találhatóak, vagy nincs jogosultsága megtekinteni.",
			} satisfies ServerResponse)
			return
		}

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres lekérés!",
			} satisfies ServerResponse,
			data: result.rows,
		})
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Get a single ticket
router.get("/tickets/:id", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user as User
	const { id } = req.params

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const ticket = await fetchTicketDetails(Number(id), user)

		if (!ticket) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod megtekinteni!",
			} satisfies ServerResponse)
			return
		}

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres lekérés!",
			} satisfies ServerResponse,
			data: ticket,
		})
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Update ticket status
router.patch("/tickets/:id/status", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user as User
	const { id } = req.params

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const ticket = await fetchTicketDetails(Number(id), user)

		if (!ticket) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod frissíteni!",
			} satisfies ServerResponse)
			return
		}

		// Check if the user has permission to close the ticket
		if (!hasPermission(user, "tickets", "close", ticket)) {
			res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultsága a hibajegy státuszának frissítéséhez!",
			} satisfies ServerResponse)
			return
		}

		const result = await postgres.query(
			"UPDATE ticket SET closed = NOT closed WHERE id = $1",
			[id]
		)

		if (result.rowCount === 0) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod frissíteni!",
			} satisfies ServerResponse)
			return
		}

		res.json({
			error: false,
			type: "message",
			messageType: "success",
			message: "A hibajegy státusza sikeresen frissítve!",
		} satisfies ServerResponse)
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Add a response to a ticket
router.post("/tickets/:id/response", getUserFromCookie, async (req: Request, res: Response) => {
	const schema = object({ content: string().min(10) })
	const user = req.user as User
	const { id: ticketId } = req.params

	if (!validateUser(user, res)) return

	const data = validateRequestBody(schema, req.body, res)
	if (!data) return

	const { content } = data

	try {
		await postgres.connect()
		const ticket = await fetchTicketDetails(Number(ticketId), user)

		if (!ticket) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod válaszolni!",
			} satisfies ServerResponse)
			return
		}

		// Check if the user has permission to respond to the ticket
		if (!hasPermission(user, "tickets", "respond", ticket)) {
			res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod válaszolni erre a hibajegyre!",
			} satisfies ServerResponse)
			return
		}

		const responseQuery = "INSERT INTO ticket_response (content, ticket_id, user_id) VALUES ($1, $2, $3) RETURNING *"
		const responseResult = await postgres.query(responseQuery, [content, ticketId, user.id])

		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres válasz hozzáadás!",
		} satisfies ServerResponse)
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Get all responses for a ticket
router.get("/tickets/:id/responses", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user as User
	const { id: ticketId } = req.params

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const ticket = await fetchTicketDetails(Number(ticketId), user)

		if (!ticket) {
			res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod megtekinteni a válaszokat!",
			} satisfies ServerResponse)
			return
		}

		const responsesQuery = `
        SELECT tr.*, u.name
        FROM ticket_response tr
                 JOIN "user" u ON tr.user_id = u.id
        WHERE tr.ticket_id = $1
        ORDER BY tr.created_at
		`
		const responsesResult = await postgres.query(responsesQuery, [ticketId])

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres válaszok lekérése!",
			} satisfies ServerResponse,
			data: responsesResult.rows,
		})
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})