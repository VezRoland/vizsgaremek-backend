import type { User } from "@supabase/supabase-js"
import { type Schedule, type Submission, type Ticket, type Training, UserRole } from "../types/database"

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

interface CompanyData {
	id: string;
}

type Permissions = {
	tickets: {
		dataType: Pick<Ticket, "userId" | "companyId">
		action: "view" | "create" | "delete" | "close" | "respond"
	},
	schedule: {
		dataType: Pick<Schedule, "userId" | "companyId" | "finalized">,
		action: "view" | "create" | "finalize" | "delete" | "update"
	},
	training: {
		dataType: Pick<Training, "companyId" | "role">,
		action: "view" | "create" | "delete" | "update"
	},
	submission: {
		dataType: Pick<Submission, "companyId" | "role" | "userId">,
		action: "view" | "create"
	},
	company: {
		dataType: CompanyData,
		action: "updateName" | "updateLogo"
	}
}

const ROLES = {
	[UserRole.Admin]: {
		tickets: {
			view: (_, data) => data.companyId === null, // Admins can only view tickets without a company
			create: false, // Admins cannot create tickets
			delete: (_, data) => data.companyId === null, // Admins can only delete tickets without a company
			close: (_, data) => data.companyId === null, // Admins can only close tickets without a company
			respond: (_, data) => data.companyId === null // Admins can only respond to tickets without a company
		},
		schedule: {
			view: false, // Admins cannot view schedules
			create: false, // Admins cannot create schedules
			finalize: false, // Admins cannot finalize
			delete: false, // Admins cannot delete schedules
			update: false // Admins cannot update schedules
		},
		training: {
			view: false, // Admins cannot view training
			create: false, // Admins cannot create training
			delete: false, // Admins cannot delete training
			update: false // Admins cannot update training
		},
		submission: {
			view: false, // Admins cannot view submissions
			create: false // Admins cannot create submissions
		},
		company: {
			updateName: false, // Admins cannot update company name
			updateLogo: false, // Admins cannot update company logo
		}
	},
	[UserRole.Owner]: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Owners can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Owners can create tickets in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can close their company's tickets
			respond: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId // Owners can respond to their own or their company's tickets
		},
		schedule: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only view schedules in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only create schedules for their company
			finalize: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only finalize schedules in their company
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only delete schedules in their company
			update: (user, data) => user.user_metadata.company_id === data.companyId // Owners can only update schedules in their company
		},
		training: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only view training in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only create training in their company
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only delete training in their company
			update: (user, data) => user.user_metadata.company_id === data.companyId // Owners can only update training in their company
		},
		submission: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Owners can only view submissions in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId // Owners can only create submissions in their company
		},
		company: {
			updateName: (user, data) => user.user_metadata.company_id === data.id, // Owners can update their company's name
			updateLogo: (user, data) => user.user_metadata.company_id === data.id, // Owners can update their company's logo
		}
	},
	[UserRole.Leader]: {
		tickets: {
			view: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId, // Leaders can view their own or their company's tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Leaders can create in their company or towards administrators
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can delete their company's tickets
			close: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can close their company's tickets
			respond: (user, data) => user.id === data.userId || user.user_metadata.company_id === data.companyId // Leaders can respond to their own or their company's tickets
		},
		schedule: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only view schedules in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only create schedules for themselves or anyone in below them (Made sure in the post route!)
			finalize: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only finalize schedules in their company
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only delete schedules in their company
			update: (user, data) => user.user_metadata.company_id === data.companyId // Leaders can only update schedules in their company
		},
		training: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only view training in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only create training in their company
			delete: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only delete training in their company
			update: (user, data) => user.user_metadata.company_id === data.companyId // Leaders can only update training in their company
		},
		submission: {
			view: (user, data) => user.user_metadata.company_id === data.companyId, // Leaders can only view submissions in their company
			create: (user, data) => user.user_metadata.company_id === data.companyId // Leaders can only create submissions in their company
		},
		company: {
			updateName: false, // Leaders cannot update company name
			updateLogo: false, // Leaders cannot update company logo
		}
	},
	[UserRole.Employee]: {
		tickets: {
			view: (user, data) => user.id === data.userId, // Employees can only view their own tickets
			create: (user, data) => user.user_metadata.company_id === data.companyId || data.companyId === null, // Employees can create tickets in their company or towards administrators
			delete: false, // Employees cannot delete tickets
			close: false, // Employees cannot close tickets
			respond: (user, data) => user.id === data.userId // Employees can only respond to their own tickets
		},
		schedule: {
			view: (user, data) => user.id === data.userId, // Employees can only view their own schedules
			create: (user, data) => user.id === data.userId, // Employees can only create schedules for themselves
			finalize: false, // Employees cannot finalize schedules
			delete: (user, data) => user.id === data.userId && !data.finalized, // Employees can only delete their own schedules
			update: (user, data) => user.id === data.userId && !data.finalized // Employees can only update their own schedules
		},
		training: {
			view: (user, data) => user.user_metadata.company_id === data.companyId && data.role === UserRole.Employee, // Employees can only view training in their company
			create: false, // Employees cannot create training
			delete: false, // Employees cannot delete training
			update: false // Employees cannot update training
		},
		submission: {
			view: (user, data) => user.id === data.userId, // Employees can only view their own submissions
			create: (user, data) => user.user_metadata.company_id === data.companyId && data.role === UserRole.Employee // Employees can only create submissions in their company
		},
		company: {
			updateName: false, // Employees cannot update company name
			updateLogo: false, // Employees cannot update company logo
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