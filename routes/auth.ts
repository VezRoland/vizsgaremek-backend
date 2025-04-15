import { Router } from "express"
import { supabase } from "../lib/supabase"
import postgres from "../lib/postgres"
import { getUserFromCookie } from "../lib/utils"
import { z } from "zod"
import {
	signInSchema,
	signUpEmployeeSchema,
	signUpCompanySchema
} from "../schemas/auth"

import type { CookieOptions, NextFunction, Response } from "express"
import { AuthApiError } from "@supabase/supabase-js"
import { UserRole, type User } from "../types/database"
import type { ApiResponse } from "../types/response"

const router = Router()

export const COOKIE_OPTIONS: CookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "none"
}

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
	...COOKIE_OPTIONS,
	maxAge: 7 * 24 * 60 * 60 * 1000
}

async function getCompanyIdByCode(
	code: string,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await postgres.query(
			"SELECT * FROM public.company WHERE code = $1::text",
			[code]
		)

		if (result.rows.length === 0) {
			res.status(404).json({
				status: "error",
				message: "Failed to sign up.",
				errors: { company_code: "Invalid company code" }
			} satisfies ApiResponse<unknown, Partial<z.infer<typeof signUpEmployeeSchema>>>)
		} else result.rows[0]
	} catch (error) {
		return next(error)
	}
}

async function createCompany(name: string, next: NextFunction) {
	try {
		const result = await postgres.query(
			"INSERT INTO company (name, code) VALUES ($1::text, $2::text) RETURNING id",
			[name, crypto.randomUUID().substring(0, 8)]
		)
		return result.rows[0].id
	} catch (error) {
		return next(error)
	}
}

router.post("/sign-in", async (req, res, next) => {
	const parsedBody = signInSchema.safeParse(req.body)

	if (!parsedBody.success || !parsedBody.data || parsedBody.error) {
		res.status(422).json({
			status: "error",
			message: "Invalid credentials provided.",
			errors: Object(parsedBody.error.flatten())
		} satisfies ApiResponse<unknown, Partial<z.infer<typeof signInSchema>>>)
		return
	}

	const authResponse = await supabase.auth.signInWithPassword(parsedBody.data)

	if (authResponse.error) {
		if (authResponse.error instanceof AuthApiError) {
			switch (authResponse.error.code) {
				case "invalid_credentials": {
					res.status(authResponse.error.status).json({
						status: "error",
						message: "Failed to sign in.",
						errors: {
							email: "Invalid credentials",
							password: "Invalid credentials"
						}
					} satisfies ApiResponse<unknown, Partial<z.infer<typeof signInSchema>>>)
					return
				}
				case "unexpected_failure": {
					return next(authResponse.error)
				}
				default: {
					res.status(authResponse.error.status).json({
						status: "error",
						message: authResponse.error.message
					} satisfies ApiResponse)
					return
				}
			}
		}

		return next(authResponse.error)
	}

	res.cookie("auth", authResponse.data.session.access_token, {
		...COOKIE_OPTIONS,
		maxAge: (authResponse.data.session.expires_in - 10) * 1000
	})
	res.cookie(
		"refresh",
		authResponse.data.session.refresh_token,
		REFRESH_COOKIE_OPTIONS
	)
	res.json({
		status: "success",
		message: "Signed in successfully."
	} satisfies ApiResponse)
})

router.post("/sign-up/employee", async (req, res, next) => {
	const parsedBody = signUpEmployeeSchema.safeParse(req.body)

	if (!parsedBody.success || !parsedBody.data || parsedBody.error) {
		res.status(422).json({
			status: "error",
			message: "Invalid credentials provided.",
			errors: Object(parsedBody.error.flatten())
		} satisfies ApiResponse<unknown, Partial<z.infer<typeof signUpEmployeeSchema>>>)
		return
	}

	const authResponse = await supabase.auth.admin.createUser({
		email: parsedBody.data.email,
		password: parsedBody.data.password,
		user_metadata: {
			name: parsedBody.data.name,
			role: UserRole.Employee,
			company_id: await getCompanyIdByCode(
				parsedBody.data.company_code,
				res,
				next
			)
		},
		email_confirm: true
	})

	if (authResponse.error) {
		if (authResponse.error instanceof AuthApiError) {
			switch (authResponse.error.code) {
				case "email_exists": {
					res.status(authResponse.error.status).json({
						status: "error",
						message: "Failed to sign up.",
						errors: { email: "Email is already in use" }
					} satisfies ApiResponse<unknown, Partial<z.infer<typeof signUpEmployeeSchema>>>)
					return
				}
				case "unexpected_failure": {
					return next(authResponse.error)
				}
				default: {
					res.status(authResponse.error.status).json({
						status: "error",
						message: authResponse.error.message
					} satisfies ApiResponse)
					return
				}
			}
		}

		return next(authResponse.error)
	}

	res.json({
		status: "success",
		message: "Signed up successfully."
	} satisfies ApiResponse)
})

router.post("/sign-up/company", async (req, res, next) => {
	const parsedBody = signUpCompanySchema.safeParse(req.body)

	if (!parsedBody.success || !parsedBody.data || parsedBody.error) {
		res.status(422).json({
			status: "error",
			message: "Invalid credentials provided.",
			errors: Object(parsedBody.error.flatten())
		} satisfies ApiResponse<unknown, Partial<z.infer<typeof signUpCompanySchema>>>)
		return
	}

	const authResponse = await supabase.auth.admin.createUser({
		email: parsedBody.data.email,
		password: parsedBody.data.password,
		user_metadata: {
			name: parsedBody.data.name,
			role: UserRole.Owner,
			company_id: await createCompany(parsedBody.data.company_name, next)
		},
		email_confirm: true
	})

	if (authResponse.error) {
		if (authResponse.error instanceof AuthApiError) {
			switch (authResponse.error.code) {
				case "email_exists": {
					res.status(authResponse.error.status).json({
						status: "error",
						message: "Failed to sign up.",
						errors: { email: "Email is already in use" }
					} satisfies ApiResponse<unknown, Partial<z.infer<typeof signUpCompanySchema>>>)
					return
				}
				case "unexpected_failure": {
					return next(authResponse.error)
				}
				default: {
					res.status(authResponse.error.status).json({
						status: "error",
						message: authResponse.error.message
					} satisfies ApiResponse)
					return
				}
			}
		}

		return next(authResponse.error)
	}

	res.json({
		status: "success",
		message: "Signed up successfully."
	} satisfies ApiResponse)
})

router.post("/sign-out", getUserFromCookie, async (req, res, next) => {
	const token = req.token!

	const authResponse = await supabase.auth.admin.signOut(token)

	if (authResponse.error) {
		if (authResponse.error instanceof AuthApiError) {
			switch (authResponse.error.code) {
				case "unexpected_failure": {
					return next(authResponse.error)
				}
				default: {
					res.status(authResponse.error.status).json({
						status: "error",
						message: authResponse.error.message
					} satisfies ApiResponse)
					return
				}
			}
		}

		return next(authResponse.error)
	}

	res.clearCookie("auth")
	res.clearCookie("refresh")
	res.json({
		status: "success",
		message: "Signed out successfully."
	} satisfies ApiResponse)
})

router.get("/user", getUserFromCookie, async (req, res, next) => {
	const user = req.user!

	try {
		const result = await postgres.query(
			"SELECT * FROM public.user WHERE id = $1::uuid",
			[user.id]
		)

		res.setHeader("Cache-Control", `private, max-age=${10 * 60}`)
		user.updated_at &&
			res.setHeader("Last-Modified", new Date(user.updated_at).toUTCString())

		res.json({
			status: "success",
			message: "Successfully authenticated user",
			data: result.rows[0] as User
		} satisfies ApiResponse<User>)
	} catch (error) {
		return next(error)
	}
})

export default router
