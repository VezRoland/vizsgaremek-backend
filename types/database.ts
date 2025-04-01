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

export interface Schedule {
	id: string
	start: string
	end: string
	category: ScheduleCategory
	userId: string
	companyId: string
	finalized: boolean
}

export enum ScheduleCategory {
	Paid = 1,
	Unpaid
}