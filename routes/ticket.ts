import { Router, type Request, type Response } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import type { ServerResponse } from "../lib/types/response"

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

// Create new ticket
router.post("/ticket", getUserFromCookie, async (req: Request, res: Response) => {
	const schema = object({ title: string().min(3), content: string().min(10) })
	const user = req.user

	if (!validateUser(user, res)) return

	const data = validateRequestBody(schema, req.body, res)
	if (!data) return

	const { title, content } = data

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
			message: "Sikeres hibajegy létrehozás!"
		} satisfies ServerResponse)
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Get all tickets
router.get("/tickets", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const adminResult = await postgres.query("SELECT role, company_id FROM \"user\" WHERE id = $1", [user.id])

		if (adminResult.rows.length === 0) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod a hibajegyek lekéréséhez!"
			} satisfies ServerResponse)
		}

		const { role, company_id } = adminResult.rows[0]
		let query = "SELECT * FROM ticket"
		let params: any[] = []

		if (role === 2) {
			query += " WHERE user_id = $1 OR company_id = $2"
			params.push(user.id, company_id)
		} else if (role === 3) {
			query += " WHERE user_id = $1"
			params.push(user.id)
		}

		const result = await postgres.query(query, params)

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegyek nem találhatóak, vagy nincs jogosultsága megtekinteni."
			} satisfies ServerResponse)
		}

		res.json(
			{
				message: {
					error: false,
					type: "message",
					messageType: "success",
					message: "Sikeres lekérés!"
				} satisfies ServerResponse,
				data: result.rows
			})
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Get a single ticket
router.get("/tickets/:id", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user
	const { id } = req.params

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const adminResult = await postgres.query("SELECT role, company_id FROM \"user\" WHERE id = $1", [user.id])

		if (adminResult.rows.length === 0) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod a hibajegyek lekéréséhez!"
			} satisfies ServerResponse)
		}

		const { role, company_id } = adminResult.rows[0]
		let query = "SELECT * FROM ticket WHERE id = $1"
		let params: any[] = [id]

		if (role === 2) {
			query += " AND (user_id = $2 OR company_id = $3)"
			params.push(user.id, company_id)
		} else if (role === 3) {
			query += " AND user_id = $2"
			params.push(user.id)
		}

		const result = await postgres.query(query, params)

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található, vagy nincs jogosultsága megtekinteni."
			} satisfies ServerResponse)
		}

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres lekérés!"
			} satisfies ServerResponse,
			data: result.rows[0]
		})
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

// Update ticket status
router.patch("/tickets/:id/status", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user
	const { id } = req.params

	if (!validateUser(user, res)) return

	try {
		await postgres.connect()
		const adminResult = await postgres.query("SELECT role, company_id FROM \"user\" WHERE id = $1", [user.id])

		if (adminResult.rows.length === 0) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Hibás felhasználó."
			} satisfies ServerResponse)
		}

		const { role, company_id } = adminResult.rows[0]
		let query = "UPDATE ticket SET closed = NOT closed WHERE id = $1"
		let params: any[] = [id]

		if (role === 3) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultsága a hibajegyek státuszának frissítéséhez!"
			} satisfies ServerResponse)
		} else if (role === 2) {
			query += " AND company_id = $2"
			params.push(company_id)
		}

		const result = await postgres.query(query, params)

		if (result.rowCount === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod frissíteni!"
			} satisfies ServerResponse)
		}

		res.json({
			error: false,
			type: "message",
			messageType: "success",
			message: "A hibajegy státusza sikeresen frissítve!"
		} satisfies ServerResponse)
	} catch (error) {
		handleDatabaseError(res, error)
	} finally {
		await postgres.end()
	}
})

router.post("/tickets/:id/response", getUserFromCookie, async (req: Request, res: Response) => {
	const schema = object({ content: string().min(10) });
	const user = req.user;
	const { id: ticketId } = req.params;

	if (!validateUser(user, res)) return;

	const data = validateRequestBody(schema, req.body, res);
	if (!data) return;

	const { content } = data;

	try {
		await postgres.connect();

		// Fetch the ticket and the user's role/company
		const ticketQuery = "SELECT * FROM ticket WHERE id = $1";
		const ticketResult = await postgres.query(ticketQuery, [ticketId]);

		if (ticketResult.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található!",
			} satisfies ServerResponse);
		}

		const ticket = ticketResult.rows[0];
		const userQuery = 'SELECT role, company_id FROM "user" WHERE id = $1';
		const userResult = await postgres.query(userQuery, [user.id]);

		if (userResult.rows.length === 0) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Hibás felhasználó.",
			} satisfies ServerResponse);
		}

		const { role, company_id: userCompanyId } = userResult.rows[0];

		// Check permissions based on role
		let hasPermission = false;

		if (role === 1) {
			// Project Administrator: Can respond to tickets without a company_id
			hasPermission = ticket.company_id === null;
		} else if (role === 2) {
			// Company Moderator: Can respond to tickets with the same company_id
			hasPermission = ticket.company_id === userCompanyId || ticket.user_id === user.id;
		} else if (role === 3) {
			// Company User: Can respond only to their own tickets
			hasPermission = ticket.user_id === user.id;
		}

		if (!hasPermission) {
			return res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod válaszolni erre a hibajegyre!",
			} satisfies ServerResponse);
		}

		// Insert the response into the ticket_response table
		const responseQuery = "INSERT INTO ticket_response (content, ticket_id, user_id) VALUES ($1, $2, $3) RETURNING *";
		const responseResult = await postgres.query(responseQuery, [content, ticketId, user.id]);

		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres válasz hozzáadás!",
		} satisfies ServerResponse);
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});