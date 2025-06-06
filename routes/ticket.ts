import { Router, type Request, type Response } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ServerResponse } from "../lib/types/response"
import { hasPermission } from "../lib/roles"
import type { User } from "@supabase/supabase-js"
import type { ApiResponse } from "../types/response.ts"
import { UserRole } from "../types/database.ts"

const router = Router()

// Utility function to validate request body
const validateRequestBody = (schema: any, body: any, res: Response): any | null => {
	const validation = schema.safeParse(body)
	if (!validation.success) {
		res.status(400).json({
			status: "error",
			message: "Invalid data! Please check the fields."
		} satisfies ApiResponse)
		return null
	}
	return validation.data
}

// Utility function to fetch ticket details
const fetchTicketDetails = async (ticketId: string, user: any) => {
	const ticketQuery = "SELECT * FROM ticket WHERE id = $1"
	const ticketResult = await postgres.query(ticketQuery, [ticketId])
	const ticket = ticketResult.rows[0]

	if (!ticket) return null

	// Check if the user has permission to view the ticket
	if (!hasPermission(user, "tickets", "view", {
		...ticket,
		userId: ticket.user_id,
		companyId: ticket.company_id
	})) {
		return null
	}

	return ticket
}

// Shared function to fetch ticket responses
const fetchTicketResponses = async (ticketId: string) => {
	const responsesQuery = `
      SELECT tr.*, u.name
      FROM ticket_response tr
               JOIN "user" u ON tr.user_id = u.id
      WHERE tr.ticket_id = $1
      ORDER BY tr.created_at
	`
	const responsesResult = await postgres.query(responsesQuery, [ticketId])
	return responsesResult.rows
}

// Create new ticket
router.post("/", getUserFromCookie, async (req: Request, res: Response, next) => {
	const schema = object({
		title: string().min(3),
		content: string().min(10),
		company_id: string().nullable() // Allow null for tickets without a company
	})
	const user = req.user as User

	const data = validateRequestBody(schema, req.body, res)
	if (!data) return

	const { title, content, company_id } = data

	// Check if the user has permission to create a ticket
	if (!hasPermission(user, "tickets", "create", {
		userId: user.id,
		companyId: company_id
	})) {
		res.status(403).json({
			status: "error",
			message: "You are not authorized to create a ticket!"
		} satisfies ApiResponse)
		return
	}

	// Validate company_id based on the user's role
	if (company_id !== null && user.user_metadata.company_id !== company_id) {
		res.status(403).json({
			status: "error",
			message: "You are not authorized to create a ticket for this company!"
		} satisfies ApiResponse)
		return
	}

	try {
		await postgres.query(
			"INSERT INTO ticket (title, content, user_id, company_id) VALUES ($1, $2, $3, $4)",
			[title, content, user.id, company_id]
		)
		res.status(201).json({
			status: "success",
			message: "Ticket created successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Get all tickets
router.get("/all", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User

	try {
		let query = "SELECT * FROM ticket"
		const params: any[] = []

		// Add role-specific filters to the query
		switch (Number(user.user_metadata.role)) {
			case UserRole.Admin:
				query += " WHERE company_id IS NULL" // Admins can only view tickets without a company
				break
			case UserRole.Owner:
			case UserRole.Leader:
				query += " WHERE user_id = $1 OR company_id = $2" // Owners and leaders can view their own or their company's tickets
				params.push(user.id, user.user_metadata.company_id)
				break
			case UserRole.Employee:
				query += " WHERE user_id = $1" // Employees can only view their own tickets
				params.push(user.id)
				break
			default:
				res.status(403).json({
					error: true,
					type: "message",
					messageType: "error",
					message: "You don't have permission to view the tickets!"
				} satisfies ServerResponse)
				return
		}

		const result = await postgres.query(query, params)

		if (result.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Tickets not found or you don't have permission to view them."
			} satisfies ApiResponse)
			return
		}

		res.json({
			status: "ignore",
			message: "Tickets fetched successfully!",
			data: result.rows
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Get a single ticket
router.get("/:id", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { id } = req.params

	try {
		const ticket = await fetchTicketDetails(String(id), user)

		if (!ticket) {
			res.status(404).json({
				status: "error",
				message: "Ticket not found or you don't have permission to view it."
			} satisfies ApiResponse)
			return
		}

		let responses = []
		if (Object.hasOwn(req.query, "include_responses")) {
			responses = await fetchTicketResponses(id)
		}

		res.json({
			status: "ignore",
			message: "Ticket fetched successfully!",
			data: {
				...ticket,
				...(Object.hasOwn(req.query, "include_responses") ? { responses } : {})
			}
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Update ticket status
router.patch("/:id/status", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { id } = req.params

	try {
		const ticket = await fetchTicketDetails(String(id), user)

		if (!ticket) {
			res.status(404).json({
				status: "error",
				message: "Ticket not found or you don't have permission to update it."
			} satisfies ApiResponse)
			return
		}

		// Check if the user has permission to close the ticket
		if (!hasPermission(user, "tickets", "close", {
			...ticket,
			userId: ticket.user_id,
			companyId: ticket.company_id
		})) {
			res.status(403).json({
				status: "error",
				message: "You are not authorized to close this ticket!"
			} satisfies ApiResponse)
			return
		}

		const result = await postgres.query(
			"UPDATE ticket SET closed = NOT closed WHERE id = $1",
			[id]
		)

		if (result.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "Ticket not found or you don't have permission to update it."
			} satisfies ApiResponse)
			return
		}

		res.json({
			status: "success",
			message: "Ticket status updated successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Add a response to a ticket
router.post("/:id/response", getUserFromCookie, async (req: Request, res: Response, next) => {
	const schema = object({ content: string().min(10) })
	const user = req.user as User
	const { id: ticketId } = req.params

	const data = validateRequestBody(schema, req.body, res)
	if (!data) return

	const { content } = data

	try {
		const ticket = await fetchTicketDetails(String(ticketId), user)

		if (!ticket) {
			res.status(404).json({
				status: "error",
				message: "Ticket not found or you don't have permission to respond to it."
			} satisfies ApiResponse)
			return
		}

		// Check if the user has permission to respond to the ticket
		if (!hasPermission(user, "tickets", "respond", {
			...ticket,
			userId: ticket.user_id,
			companyId: ticket.company_id
		})) {
			res.status(403).json({
				status: "error",
				message: "You are not authorized to respond to this ticket!"
			} satisfies ApiResponse)
			return
		}

		const responseQuery = "INSERT INTO ticket_response (content, ticket_id, user_id) VALUES ($1, $2, $3) RETURNING *"
		await postgres.query(responseQuery, [content, ticketId, user.id])
		res.status(201).json({
			status: "success",
			message: "Response added successfully!"
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

// Get all responses for a ticket
router.get("/:id/responses", getUserFromCookie, async (req: Request, res: Response, next) => {
	const user = req.user as User
	const { id: ticketId } = req.params

	try {
		const ticket = await fetchTicketDetails(String(ticketId), user)

		if (!ticket) {
			res.status(404).json({
				status: "error",
				message: "Ticket not found or you don't have permission to view its responses."
			} satisfies ApiResponse)
			return
		}

		const responses = await fetchTicketResponses(ticketId)

		res.json({
			status: "ignore",
			message: "Ticket responses fetched successfully!",
			data: responses
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

export default router