import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import ticketRouter from "./routes/ticket.ts"
import scheduleRouter from "./routes/schedule.ts"
import trainingRouter from "./routes/training.ts"

import type { NextFunction, Request, Response } from "express"
import type { ApiResponse } from "./types/response"
import authRouter from "./routes/auth"

const PORT = process.env.PORT || 3000
const ORIGIN = process.env.ORIGIN_URL

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())
app.use(cookieParser())

app.use("/auth", authRouter)
app.use("/ticket", ticketRouter)
app.use("/schedule", scheduleRouter)
app.use("/training", trainingRouter)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack)

	res.status(500).json({
		status: "error",
		message: "There was an unexpected error. Try again later!"
	} satisfies ApiResponse)
})

if (process.env.NODE_ENV !== 'test') {
	app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

export default app