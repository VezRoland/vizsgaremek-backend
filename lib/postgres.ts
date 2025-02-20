import "dotenv/config"
import { Client } from "pg"

const postgres = new Client({
  connectionString: process.env.VITE_POSTGRES_URL
})

export default postgres