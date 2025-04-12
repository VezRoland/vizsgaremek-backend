import { object, string } from "zod"

export const signInSchema = object({
	email: string({ message: "Email address is required" })
		.min(1, "Email address is required")
		.email("Email address is invalid"),
	password: string({ message: "Password is required" }).min(
		1,
		"Password is required"
	)
})

export const signUpSchema = object({
	name: string({ message: "Name is required" })
		.min(1, "Name is required")
		.max(150, "Name is too long (max. 150 characters)"),
	email: string({ message: "Email address is required" })
		.min(1, "Email address is required")
		.email("Email address is invalid"),
	password: string({ message: "Password is required" })
		.min(1, "Password is required")
		.min(8, "Password is too short (min. 8 characters)")
})

export const signUpCompanySchema = signUpSchema.extend({
	company_name: string({ message: "Company name is required" })
		.min(1, "Company name is required")
		.max(100, "Company name is too long (max. 100 characters)")
})

export const signUpEmployeeSchema = signUpSchema.extend({
	company_code: string({ message: "Company code is required" }).length(
		8,
		"Company code is required"
	)
})
