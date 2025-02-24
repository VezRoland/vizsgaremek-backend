import { Router, type Request } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres.ts"
import { getUserFromCookie } from "../lib/utils.ts"
import type { ServerResponse } from "../lib/types/response.ts"

const router = Router()

// Create new ticket
router.post("/tickets", getUserFromCookie, async (req: Request, res) => {
	const schema = object({ title: string(), description: string() })
	const validation = schema.safeParse(req.body)
	const user = req.user

	if (!validation.success) {
		return res.status(400).json({ error: validation.error.message })
	}

	const { title, description } = validation.data

	try {
		const result = await postgres.query(
			"INSERT INTO ticket (title, content) VALUES ($1, $2) RETURNING *",
			[title, description]
		)
		res.status(201).json({
			error: false,
			type: "message",
			messageType: "success",
			message: "Sikeres hibajegy létrehozás!",
		} satisfies ServerResponse)
	} catch (err: any) {
		res.status(500).json({
			error: true,
			type: "message",
			messageType: "error",
			message: "Sikertelen hibajegy létrehozás!",
		} satisfies ServerResponse)
	}
})