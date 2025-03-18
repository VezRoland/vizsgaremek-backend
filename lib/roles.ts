import type { User } from "@supabase/supabase-js"
import { UserRole, type Ticket, type Schedule } from "../types/database"

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
	},
	schedule:  {
		dataType: Pick<Schedule, "user_id" | "company_id" | "finalized">,
		action: "view" | "create" | "finalize" | "delete" | "update"
	}
}

const ROLES = {
	[UserRole.Admin]: {
		tickets: {
			view: (_, data) => data.company_id === null, // Admins can only view tickets without a company
			create: false, // Admins cannot create tickets
			delete: (_, data) => data.company_id === null, // Admins can only delete tickets without a company
			close: (_, data) => data.company_id === null, // Admins can only close tickets without a company
			respond: (_, data) => data.company_id === null, // Admins can only respond to tickets without a company
		},
		schedule: {
			view: false, // Admins cannot view schedules
			create: false, // Admins cannot create schedules
			finalize: false, // Admins cannot finalize
			delete: false, // Admins cannot delete schedules
			update: false, // Admins cannot update schedules
		}
	},
	[UserRole.Owner]: {
		tickets: {
			view: (user, data) => user.id === data.user_id || user.user_metadata.company_id === data.company_id, // Owners can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.company_id || data.company_id === null, // Owners can create tickets in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can close their company's tickets
			respond: (user, data) => user.id === data.user_id || user.user_metadata.company_id === data.company_id, // Owners can respond to their own or their company's tickets
		},
		schedule: {
			view: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can only view schedules in their company
			create: (user, data) => user.id === data.user_id, // Owners can only create schedules for themselves
			finalize: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can only finalize schedules in their company
			delete: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can only delete schedules in their company
			update: (user, data) => user.user_metadata.company_id === data.company_id, // Owners can only update schedules in their company
		}
	},
	[UserRole.Leader]: {
		tickets: {
			view: (user, data) => user.id === data.user_id || user.user_metadata.company_id === data.company_id, // Leaders can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.company_id || data.company_id === null, // Leaders can create in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can close their company's tickets
			respond: (user, data) => user.id === data.user_id || user.user_metadata.company_id === data.company_id, // Leaders can respond to their own or their company's tickets
		},
		schedule: {
			view: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can only view schedules in their company
			create: (user, data) => user.id === data.user_id, // Leaders can only create schedules for themselves
			finalize: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can only finalize schedules in their company
			delete: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can only delete schedules in their company
			update: (user, data) => user.user_metadata.company_id === data.company_id, // Leaders can only update schedules in their company
		}
	},
	[UserRole.Employee]: {
		tickets: {
			view: (user, data) => user.id === data.user_id, // Employees can only view their own tickets
			create: (user, data) => user.user_metadata.company_id === data.company_id || data.company_id === null, // Employees can create tickets in their company or towards administrators
			delete: false, // Employees cannot delete tickets
			close: false, // Employees cannot close tickets
			respond: (user, data) => user.id === data.user_id, // Employees can only respond to their own tickets
		},
		schedule: {
			view: (user, data) => user.id === data.user_id, // Employees can only view their own schedules
			create: (user, data) => user.id === data.user_id, // Employees can only create schedules for themselves
			finalize: false, // Employees cannot finalize schedules
			delete: (user, data) => user.id === data.user_id && !data.finalized, // Employees can only delete their own schedules
			update: (user, data) => user.id === data.user_id && !data.finalized, // Employees can only update their own schedules
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