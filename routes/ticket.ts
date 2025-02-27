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

// Utility function to fetch user role and company
const fetchUserRoleAndCompany = async (userId: number) => {
	const userQuery = 'SELECT role, company_id FROM "user" WHERE id = $1';
	const userResult = await postgres.query(userQuery, [userId]);
	return userResult.rows[0];
};

// Utility function to fetch ticket details
const fetchTicketDetails = async (ticketId: number) => {
	const ticketQuery = "SELECT * FROM ticket WHERE id = $1";
	const ticketResult = await postgres.query(ticketQuery, [ticketId]);
	return ticketResult.rows[0];
};

// Utility function to check permissions
const checkTicketPermissions = (role: number, userCompanyId: number | null, ticket: any, userId: number): boolean => {
	if (role === 1) {
		// Project Administrator: Can access tickets without a company_id
		return ticket.company_id === null;
	} else if (role === 2) {
		// Company Moderator: Can access tickets with the same company_id or their own tickets
		return ticket.company_id === userCompanyId || ticket.user_id === userId;
	} else if (role === 3) {
		// Company User: Can access only their own tickets
		return ticket.user_id === userId;
	}
	return false;
};

// Create new ticket
router.post("/ticket", getUserFromCookie, async (req: Request, res: Response) => {
	const schema = object({ title: string().min(3), content: string().min(10) });
	const user = req.user;

	if (!validateUser(user, res)) return;

	const data = validateRequestBody(schema, req.body, res);
	if (!data) return;

	const { title, content } = data;

	try {
		await postgres.connect();
		const result = await postgres.query(
			"INSERT INTO ticket (title, content, user_id) VALUES ($1, $2, $3)",
			[title, content, user.id]
		);
		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres hibajegy létrehozás!",
		} satisfies ServerResponse);
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});

// Get all tickets
router.get("/tickets", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user;

	if (!validateUser(user, res)) return;

	try {
		await postgres.connect();
		const { role, company_id } = await fetchUserRoleAndCompany(user.id);

		let query = "SELECT * FROM ticket";
		let params: any[] = [];

		if (role === 2) {
			query += " WHERE user_id = $1 OR company_id = $2";
			params.push(user.id, company_id);
		} else if (role === 3) {
			query += " WHERE user_id = $1";
			params.push(user.id);
		}

		const result = await postgres.query(query, params);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegyek nem találhatóak, vagy nincs jogosultsága megtekinteni.",
			} satisfies ServerResponse);
		}

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres lekérés!",
			} satisfies ServerResponse,
			data: result.rows,
		});
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});

// Get a single ticket
router.get("/tickets/:id", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user;
	const { id } = req.params;

	if (!validateUser(user, res)) return;

	try {
		await postgres.connect();
		const { role, company_id } = await fetchUserRoleAndCompany(user.id);
		const ticket = await fetchTicketDetails(Number(id));

		if (!ticket) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található!",
			} satisfies ServerResponse);
		}

		const hasPermission = checkTicketPermissions(role, company_id, ticket, user.id);
		if (!hasPermission) {
			return res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod megtekinteni ezt a hibajegyet!",
			} satisfies ServerResponse);
		}

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres lekérés!",
			} satisfies ServerResponse,
			data: ticket,
		});
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});

// Update ticket status
router.patch("/tickets/:id/status", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user;
	const { id } = req.params;

	if (!validateUser(user, res)) return;

	try {
		await postgres.connect();
		const { role, company_id } = await fetchUserRoleAndCompany(user.id);

		let query = "UPDATE ticket SET closed = NOT closed WHERE id = $1";
		let params: any[] = [id];

		if (role === 3) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultsága a hibajegyek státuszának frissítéséhez!",
			} satisfies ServerResponse);
		} else if (role === 2) {
			query += " AND company_id = $2";
			params.push(company_id);
		}

		const result = await postgres.query(query, params);

		if (result.rowCount === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található vagy nincs jogosultságod frissíteni!",
			} satisfies ServerResponse);
		}

		res.json({
			error: false,
			type: "message",
			messageType: "success",
			message: "A hibajegy státusza sikeresen frissítve!",
		} satisfies ServerResponse);
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});

// Add a response to a ticket
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
		const { role, company_id } = await fetchUserRoleAndCompany(user.id);
		const ticket = await fetchTicketDetails(Number(ticketId));

		if (!ticket) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található!",
			} satisfies ServerResponse);
		}

		const hasPermission = checkTicketPermissions(role, company_id, ticket, user.id);
		if (!hasPermission) {
			return res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod válaszolni erre a hibajegyre!",
			} satisfies ServerResponse);
		}

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

// Get all responses for a ticket
router.get("/tickets/:id/responses", getUserFromCookie, async (req: Request, res: Response) => {
	const user = req.user;
	const { id: ticketId } = req.params;

	if (!validateUser(user, res)) return;

	try {
		await postgres.connect();
		const { role, company_id } = await fetchUserRoleAndCompany(user.id);
		const ticket = await fetchTicketDetails(Number(ticketId));

		if (!ticket) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található!",
			} satisfies ServerResponse);
		}

		const hasPermission = checkTicketPermissions(role, company_id, ticket, user.id);
		if (!hasPermission) {
			return res.status(403).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod megtekinteni a hibajegy válaszait!",
			} satisfies ServerResponse);
		}

		const responsesQuery = `
            SELECT tr.*, u.name
            FROM ticket_response tr
                     JOIN "user" u ON tr.user_id = u.id
            WHERE tr.ticket_id = $1
            ORDER BY tr.created_at
		`;
		const responsesResult = await postgres.query(responsesQuery, [ticketId]);

		res.json({
			message: {
				error: false,
				type: "message",
				messageType: "success",
				message: "Sikeres válaszok lekérése!",
			} satisfies ServerResponse,
			data: responsesResult.rows,
		});
	} catch (error) {
		handleDatabaseError(res, error);
	} finally {
		await postgres.end();
	}
});