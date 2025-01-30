import { User } from "@supabase/supabase-js"

declare module "express" {
	interface Request {
		user?: User
	}
}
