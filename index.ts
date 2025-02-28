import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import postgres from "./lib/postgres"
import ticketRouter from "./routes/ticket.ts"
import { getUserFromCookie } from "./lib/utils"
import { object, string, z } from "zod"

import type { NextFunction, Request, Response } from "express"
import type { ApiResponse } from "./types/response"
import type { signUpEmployeeSchema } from "./schemas/auth"

const PORT = process.env.PORT || 3000
const ORIGIN = "http://localhost:5173"

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())
app.use(cookieParser())

app.use("/ticket", ticketRouter)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack)

	res.status(500).json({
		status: "error",
		message: "There was an unexpected error. Try again later!"
	} satisfies ApiResponse)
})

app.get("/user", getUserFromCookie, async (req, res, next) => {
	try {
		const result = await postgres.query(
			"SELECT * FROM public.user WHERE id = $1::uuid",
			[req.user!.id]
		)

		res.json({
			status: "success",
			message: "Successful authorization.",
			data: result.rows[0]
		} satisfies ApiResponse)
	} catch (error) {
		next(error)
	}
})

app.get("/company/:code", async (req, res, next) => {
	const { code } = req.params

	try {
		const result = await postgres.query(
			"SELECT * FROM company WHERE code = $1::text",
			[code]
		)

		if (result.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "There isn't any company with the provided code.",
				errors: { code: "Invalid company code" }
			} satisfies ApiResponse<null, Partial<z.infer<typeof signUpEmployeeSchema>>>)
		} else res.json(result.rows[0])
	} catch (error) {
		next(error)
	}
})

app.post("/company", async (req: Request, res, next) => {
	const { data, success, error } = object({ name: string() }).safeParse(
		req.body
	)

	if (error || !success) {
		res.status(400).json({
			status: "error",
			message: "The provided data is incorrect."
		} satisfies ApiResponse)
	} else {
		try {
			const result = await postgres.query(
				"INSERT INTO company (name, code) VALUES ($1::text, $2::text) RETURNING *",
				[data.name, crypto.randomUUID().substring(0, 8)]
			)

			res.status(201).json({
				status: "success",
				message: "The company was successfully signed up.",
        data: result.rows[0]
			} satisfies ApiResponse)
		} catch (error) {
			next(error)
		}
	}
})

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
