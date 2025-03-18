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
	user_id: string
	company_id: string
	created_at: string
}

export interface Schedule {
	id: string
	start: string
	end: string
	category: ScheduleCategory
	user_id: string
	company_id: string
	finalized: boolean
}

export enum ScheduleCategory {
	Paid = 1,
	Unpaid
}