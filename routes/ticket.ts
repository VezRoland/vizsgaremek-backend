import { Router, type Request } from "express"
import { boolean, object, string } from "zod"
import postgres from "../lib/postgres.ts"
import { getUserFromCookie } from "../lib/utils.ts"
import type { ServerResponse } from "../lib/types/response.ts"

const router = Router()


// Create new ticket
router.post("/ticket", getUserFromCookie, async (req: Request, res) => {
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
		await postgres.end();

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegyek nem találhatóak, vagy nincs jogosultsága megtekinteni.",
			} satisfies ServerResponse);
		}

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

// Get a single ticket
router.get("/tickets/:id", getUserFromCookie, async (req: Request, res) => {
	const user = req.user;
	const { id } = req.params;

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
		let query = "SELECT * FROM ticket WHERE id = $1";
		let params: any[] = [id];

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
		await postgres.end();

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: true,
				type: "message",
				messageType: "error",
				message: "A hibajegy nem található, vagy nincs jogosultsága megtekinteni.",
			} satisfies ServerResponse);
		}

		res.json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres lekérés!"
			// data: result.rows[0],
		} satisfies ServerResponse);
	} catch (err: any) {
		console.error("Database error:", err);

		res.status(500).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nem sikerült lekérni a hibajegyet!"
		} satisfies ServerResponse);
	}
});

router.patch("/tickets/:id/status", getUserFromCookie, async (req : Request, res) => {
	const user = req.user;
	const { id } = req.params;

	const schema = object({ status: boolean() });
	const validation = schema.safeParse(req.body);

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
			message: "Hibás státuszérték! Csak 'true' vagy 'false' lehet.",
		} satisfies ServerResponse);
	}

	let adminQuery = 'SELECT role, company_id FROM "user" WHERE id = $1';
	let adminParams = [user.id];
	const adminResult = await postgres.query(adminQuery, adminParams);

	if (adminResult.rows.length === 0) {
		return res.status(401).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs jogosultságod a hibajegyek frissítéséhez!",
		} satisfies ServerResponse);
	}

	const userRole = adminResult.rows[0].role;
	const companyId = adminResult.rows[0].company_id;

	if (userRole !== 2 && userRole !== 3) {
		return res.status(403).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nincs jogosultság a hibajegy frissítéséhez!",
		} satisfies ServerResponse);
	}

	const { status } = validation.data;

	let query = "UPDATE ticket SET closed = $1 WHERE id = $2 RETURNING *";
	let params: any[] = [status, id];

	if (userRole === 3) {
		query += " AND user_id = $3";
		params.push(user.id);
	}

	try {
		const result = await postgres.query(query, params);

		if (result.rows.length === 0) {
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
			message: `A hibajegy státusza sikeresen frissítve: ${status ? "Kész" : "Folyamatban"}`,
		} satisfies ServerResponse);
	} catch (err: any) {
		console.error("Database error:", err);

		res.status(500).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Nem sikerült frissíteni a hibajegy státuszát!",
		} satisfies ServerResponse);
	}
});