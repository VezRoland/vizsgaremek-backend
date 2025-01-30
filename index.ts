import express from "express"
import cors from "cors"

const PORT = process.env.PORT || 3000
const ORIGIN = "http://localhost:5173"

const app = express()
app.use(cors({ credentials: true, origin: ORIGIN }))
app.use(express.json())

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))
