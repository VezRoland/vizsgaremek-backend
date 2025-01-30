import "dotenv/config"
import { Client } from "pg"

const postgres = new Client({
  connectionString: process.env.POSTGRES_URL
})

export default postgres