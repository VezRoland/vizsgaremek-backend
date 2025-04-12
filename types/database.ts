export interface User {
	id: string
	name: string
	age?: number
	hourly_wage?: number
	role: UserRole
	company_id: string
	verified: boolean
	created_at: string
}

export enum UserRole {
	Employee = 1,
	Leader,
	Owner,
	Admin
}