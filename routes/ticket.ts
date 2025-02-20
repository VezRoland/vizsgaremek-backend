import { Router } from "express"
import { object, string } from "zod"
import postgres from "../lib/postgres.ts"

const router = Router()

// Create new ticket
router.post("/tickets", async (req, res) => {
	const schema = object({ title: string(), description: string() })
	const validation = schema.safeParse(req.body)

	if (!validation.success) {
		return res.status(400).json({ error: validation.error.message })
	}

	const { title, description } = validation.data

	try {
		const result = await postgres.query(
			"INSERT INTO tickets (title, description) VALUES ($1, $2) RETURNING *",
			[title, description]
		)
		res.status(201).json(result.rows[0])
	} catch (err: any) {
		res.status(500).json({ error: err.message })
	}
})