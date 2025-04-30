import {Pool} from "pg"

const postgres = new Pool({
	connectionString: process.env.POSTGRES_URL
})

export default postgres