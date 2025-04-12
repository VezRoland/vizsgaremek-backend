import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRouter from "./routes/auth"

const PORT = process.env.PORT || 3000
const ORIGIN = process.env.ORIGIN_URL

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())
app.use(cookieParser())

app.use("/auth", authRouter)

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
