import { Router, type Request } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres.ts"
import { getUserFromCookie } from "../lib/utils.ts"
import type { ServerResponse } from "../lib/types/response.ts"

const router = Router()

// Create new ticket
router.post("/tickets", getUserFromCookie, async (req: Request, res) => {
	const schema = object({ title: string().min(3), content: string().min(10) });
	const validation = schema.safeParse(req.body);
	const user = req.user;

	if (!user) {
		return res.status(401).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs bejelentkezve!",
		} satisfies ServerResponse);
	}

	if (!validation.success) {
		return res.status(400).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Hibás adatok! Kérlek, ellenőrizd a mezőket."
		} satisfies ServerResponse);
	}

	const { title, content } = validation.data;

	try {
		await postgres.connect();
		await postgres.query(
			"INSERT INTO ticket (title, content, user_id) VALUES ($1, $2, $3) RETURNING *",
			[title, content, user.id]
		)
		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres hibajegy létrehozás!"
		} satisfies ServerResponse);
		await postgres.end();
	} catch (err: any) {
		console.error("Database error:", err);

		res.status(500).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Sikertelen hibajegy létrehozás!"
		} satisfies ServerResponse);
	}
});

// Get all tickets
router.get("/tickets", getUserFromCookie, async (req: Request, res) => {
	const user = req.user;

	if (!user) {
		return res.status(401).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs bejelentkezve!",
		} satisfies ServerResponse);
	}

	try {
		await postgres.connect();
		let query = "SELECT * FROM ticket";
		let params: any[] = [];

		let adminQuery = 'SELECT role, company_id FROM "user" WHERE id = $1';
		let adminParams = [user.id];
		const adminResult = await postgres.query(adminQuery, adminParams);

		if (adminResult.rows.length === 0) {
			return res.status(401).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "Nincs jogosultságod a hibajegyek lekéréséhez!"
			} satisfies ServerResponse);
		}

		if (adminResult.rows[0].role === 2) {
			query += " WHERE user_id = $1 OR company_id = $2";
			params.push(user.id, adminResult.rows[0].company_id);
		} else if (adminResult.rows[0].role === 3) {
			query += " WHERE user_id = $1";
			params.push(user.id);
		}

		const result = await postgres.query(query, params);

		res.json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres lekérés!",
			// tickets: result.rows
		} satisfies ServerResponse);
	} catch (err: any) {
		res.status(500).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nem sikerült lekérni a hibajegyeket!"
		} satisfies ServerResponse);
	}
});
