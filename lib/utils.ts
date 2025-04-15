import { supabase } from "./supabase"
import { object, string } from "zod"
import { COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from "../routes/auth"

import type { NextFunction, Request, Response } from "express"
import type { Session, User } from "@supabase/supabase-js"
import type { ApiResponse } from "../types/response"

export async function getUserFromCookie(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const parsedCookie = object({
		auth: string().min(1).optional(),
		refresh: string().min(1).optional()
	}).safeParse(req.cookies)

	if (!parsedCookie.success || !parsedCookie.data || parsedCookie.error) {
		return next(
			res.status(401).json({
				status: "error",
				message: "You are not signed in."
			} satisfies ApiResponse)
		)
	}

	let session: Session | null = null
	let user: User | null = null

	if (!parsedCookie.data.auth && parsedCookie.data.refresh) {
		const authResponse = await supabase.auth.refreshSession({
			refresh_token: parsedCookie.data.refresh
		})

		if (authResponse.error) {
			res.clearCookie("refresh")
			return next(
				res.status(401).json({
					status: "error",
					message: "You are not signed in."
				} satisfies ApiResponse)
			)
		}

		session = authResponse.data.session
		user = authResponse.data.user
	}

	const authResponse = await supabase.auth.getUser(parsedCookie.data.auth)

	if ((!parsedCookie.data.auth && !user) || authResponse.error) {
		res.clearCookie("auth")
		return next(
			res.status(401).json({
				status: "error",
				message: "You are not signed in."
			} satisfies ApiResponse)
		)
	}

	user = user || authResponse.data.user

	session &&
		res.cookie("auth", session.access_token, {
			...COOKIE_OPTIONS,
			maxAge: (session.expires_in - 10) * 1000
		})
	session &&
		res.cookie("refresh", session.refresh_token, REFRESH_COOKIE_OPTIONS)

	req.user = user
	req.token = parsedCookie.data.auth
	return next()
}
