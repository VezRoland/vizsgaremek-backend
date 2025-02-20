import express, { type Request } from "express"
import cors from "cors"
import postgres from "./lib/postgres"
import { object, string } from "zod"

const PORT = process.env.PORT || 3000
const ORIGIN = "http://localhost:5173"

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())

app.post("/company", async (req: Request, res) => {
	const { data, error } = object({ name: string() }).safeParse(req.body)

	if (error || !data) return res.status(400).json({ msg: "bad" })

	postgres.connect()
	try {
		await postgres.query(
			"INSERT INTO company (name, code) VALUES ($1::text, $2::text)",
			[data.name, crypto.randomUUID().substring(0, 8)]
		)
		res.json({ msg: "haha" })
	} catch (error) {
		console.log(error)
		res.status(400).json({ msg: "bad" })
	}
	postgres.end()
})

app.get("/company/:code", async (req, res) => {
	const { code } = req.params

	if (!code) return res.status(400).json({ msg: "bad" })

	postgres.connect()
	try {
		const response = await postgres.query(
			"SELECT * FROM company WHERE code = $1::text",
			[code]
		)
		res.json(response.rows[0])
	} catch (error) {
		console.log(error)
		res.status(400).json({ msg: "bad" })
	}
	postgres.end()
})

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
