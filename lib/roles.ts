import type { User } from "@supabase/supabase-js"
import type { Ticket, UserRole } from "../types/database"

type PermissionCheck<Key extends keyof Permissions> =
	| boolean
	| ((user: User, data: Permissions[Key]["dataType"]) => boolean)

type RolesWithPermissions = {
	[R in UserRole]: Partial<{
		[Key in keyof Permissions]: Partial<{
			[Action in Permissions[Key]["action"]]: PermissionCheck<Key>
		}>
	}>
}

type Permissions = {
	tickets: {
		dataType: Ticket
		action: "view" | "create" | "delete" | "close"
	}
}

const ROLES = {
	admin: {
		tickets: {
			view: (_, data) => data.companyId === null,
			close: (_, data) => data.companyId === null,
			create: false,
			delete: (_, data) => data.companyId === null
		}
	},
	owner: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId,
			close: (user, data) => user.user_metadata.company_id === data.companyId,
			delete: (user, data) => user.user_metadata.company_id === data.companyId,
			create: true
		}
	},
	leader: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId,
			close: (user, data) => user.user_metadata.company_id === data.companyId,
			delete: (user, data) => user.user_metadata.company_id === data.companyId,
			create: true
		}
	},
	employee: {
		tickets: {
			view: (user, data) => user.id === data.userId,
			close: false,
			delete: false,
			create: true
		}
	}
} as const satisfies RolesWithPermissions

export function hasPermission<Resource extends keyof Permissions>(
	user: User,
	resource: Resource,
	action: Permissions[Resource]["action"],
	data?: Permissions[Resource]["dataType"]
) {
	const permission = (ROLES as RolesWithPermissions)[user.user_metadata.role][
		resource
		]?.[action]
	if (permission == null) return false

	if (typeof permission === "boolean") return permission
	return data != null && permission(user, data)
}
