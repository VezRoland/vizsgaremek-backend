// backend/lib/utils.ts
import { supabase } from "./supabase"
import { object, string } from "zod"
import { COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from "./constants"
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

	if (!parsedCookie.success) {
		console.error("Cookie parsing failed:", parsedCookie.error.format())
		return res.status(401).json({
			status: "error",
			message: "Invalid cookies provided."
		} satisfies ApiResponse)
	}

	const authCookieToken = parsedCookie.data.auth
	const refreshCookieToken = parsedCookie.data.refresh

	let session: Session | null = null
	let user: User | null = null
	let currentAccessToken: string | undefined = authCookieToken

	// Scenario 1: No access token, but refresh token exists
	if (!authCookieToken && refreshCookieToken) {
		console.log("Attempting token refresh...")
		const refreshResponse = await supabase.auth.refreshSession({
			refresh_token: refreshCookieToken
		})

		if (refreshResponse.error || !refreshResponse.data.session || !refreshResponse.data.user) {
			console.error("Refresh session failed:", refreshResponse.error)
			res.clearCookie("auth")
			res.clearCookie("refresh")
			return res.status(401).json({
				status: "error",
				message: refreshResponse.error?.message || "Invalid refresh token or session."
			} satisfies ApiResponse)
		}

		// Refresh SUCCESS
		console.log("Token refresh successful.")
		session = refreshResponse.data.session
		user = refreshResponse.data.user
		currentAccessToken = session.access_token

		res.cookie("auth", session.access_token, {
			...COOKIE_OPTIONS,
			maxAge: (session.expires_in - 10) * 1000
		})
		res.cookie("refresh", session.refresh_token, REFRESH_COOKIE_OPTIONS)

	} else if (authCookieToken) {
		// Scenario 2: Access token IS present, try validating it
		const getUserResponse = await supabase.auth.getUser(authCookieToken)

		if (getUserResponse.error || !getUserResponse.data.user) {
			console.error("supabase.auth.getUser failed:", getUserResponse.error)
			res.clearCookie("auth")
			return res.status(401).json({
				status: "error",
				message: getUserResponse.error?.message || "Invalid session or access token."
			} satisfies ApiResponse)
		}
		user = getUserResponse.data.user

	}

	if (!user) {
		return res.status(401).json({
			status: "error",
			message: "Authentication required. No valid session found."
		} satisfies ApiResponse)
	}

	req.user = user
	req.token = currentAccessToken
	return next()
}