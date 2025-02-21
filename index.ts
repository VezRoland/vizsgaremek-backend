import express, { type Request } from "express"
import cors from "cors"
import postgres from "./lib/postgres"
import { object, string, z } from "zod"
import type { ServerResponse } from "./types/response"
import type { signUpEmployeeSchema } from "./schemas/auth"

const PORT = process.env.PORT || 3000
const ORIGIN = "http://localhost:5173"

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())

app.get("/company/:code", async (req, res) => {
	const { code } = req.params

	try {
		const result = await postgres.query(
			"SELECT * FROM company WHERE code = $1::text",
			[code]
		)

		if (result.rows.length === 0) {
			res.status(404).json({
				error: true,
				type: "field",
				fields: { code: "Érvénytelen cég kód!" }
			} satisfies ServerResponse<z.infer<typeof signUpEmployeeSchema>>)
		} else res.json(result.rows[0])
	} catch (error) {
		res.status(500).json({
			error: true,
			type: "message",
			message: "Váratlan hiba történt. Próbálja újra!",
			messageType: "error"
		} satisfies ServerResponse)
	}
})

app.post("/company", async (req: Request, res) => {
	const { data, success, error } = object({ name: string() }).safeParse(
		req.body
	)

	if (error || !success) {
		res.status(500).json({
			error: true,
			type: "message",
			message: "Váratlan hiba történt. Próbálja újra!",
			messageType: "error"
		} satisfies ServerResponse)
	} else {
		try {
			await postgres.query(
				"INSERT INTO company (name, code) VALUES ($1::text, $2::text)",
				[data.name, crypto.randomUUID().substring(0, 8)]
			)
			res.status(201).json({})
		} catch (error) {
			res.status(500).json({
				error: true,
				type: "message",
				message: "Váratlan hiba történt. Próbálja újra!",
				messageType: "error"
			} satisfies ServerResponse)
		}
	}
})

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
