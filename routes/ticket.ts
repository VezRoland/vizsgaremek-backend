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
