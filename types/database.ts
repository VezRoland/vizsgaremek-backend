export enum UserRole {
	Employee = 1,
	Leader,
	Owner,
	Admin
}

export interface Ticket {
	id: string
	title: string
	content: string
	closed: boolean
	userId: string
	companyId: string
	created_at: string
}
