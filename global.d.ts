import type { User } from "@supabase/supabase-js"
import type { UserRole } from "./types/database"

declare module "@supabase/supabase-js" {
	interface UserMetadata {
		name: string
		age?: number
		hourly_wage?: number
		role: UserRole
		company_id: string | null
		verified: boolean
		created_at: string
	}
}

declare global {
	namespace Express {
		export interface Request {
			user?: User
      token?: string
		}
	}
}
