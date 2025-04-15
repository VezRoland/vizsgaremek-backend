export interface User {
	id: string
	name: string
	age?: number
	hourly_wage?: number
	role: UserRole
	company_id: string | null
	verified: boolean
	created_at: string
}

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
	companyId: string | null
	created_at: string
}

export interface Schedule {
	id: string
	start: string
	end: string
	category: ScheduleCategory
	userId: string
	companyId: string | null
	finalized: boolean
}

export enum ScheduleCategory {
	Paid = 1,
	Unpaid
}

export interface Training {
	id: string;
	name: string;
	description: string;
	isActive: boolean;
	role: UserRole;
	companyId: string | null;
	created_at: string;
	questions: Array<{
		id: string;
		name: string;
		answers: string[];
		multipleCorrect: boolean;
	}>;
}

export interface Submission {
	id: string;
	userId: string;
	trainingId: string;
	companyId: string | null;
	role: UserRole;
	created_at: string;
	answers: Array<{
		id: string;
		answer: string;
	}>;
}
