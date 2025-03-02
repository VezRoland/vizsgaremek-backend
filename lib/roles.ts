import type { User } from "@supabase/supabase-js"
import { UserRole, type Ticket } from "../types/database"

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
		action: "view" | "create" | "delete" | "close" | "respond"
	}
}

const ROLES = {
	[UserRole.Admin]: {
		tickets: {
			view: (_, data) => data.companyId === null, // Admins can only view tickets without a company
			create: false, // Admins cannot create tickets
			delete: (_, data) => data.companyId === null, // Admins can only delete tickets without a company
			close: (_, data) => data.companyId === null, // Admins can only close tickets without a company
			respond: (_, data) => data.companyId === null, // Admins can only respond to tickets without a company
		}
	},
	[UserRole.Owner]: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Owners can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Owners can create tickets in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can close their company's tickets
			respond: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Owners can respond to their own or their company's tickets
		}
	},
	[UserRole.Leader]: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Leaders can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Leaders can create in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can close their company's tickets
			respond: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Leaders can respond to their own or their company's tickets
		}
	},
	[UserRole.Employee]: {
		tickets: {
			view: (user, data) => user.id === data.userId, // Employees can only view their own tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Employees can create tickets in their company or towards administrators
			delete: false, // Employees cannot delete tickets
			close: false, // Employees cannot close tickets
			respond: (user, data) => user.id === data.userId, // Employees can only respond to their own tickets
		}
	}
} as const satisfies RolesWithPermissions

export function hasPermission<Resource extends keyof Permissions>(
	user: User,
	resource: Resource,
	action: Permissions[Resource]["action"],
	data?: Permissions[Resource]["dataType"]
) {
	const role = user.user_metadata.role as UserRole
	const permission = (ROLES as RolesWithPermissions)[role][resource]?.[action]
	if (permission == null) return false

	if (typeof permission === "boolean") return permission
	return data != null && permission(user, data)
}