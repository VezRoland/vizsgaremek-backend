import { supabase } from "./supabase"
import { object, string } from "zod"

import type { NextFunction, Request, Response } from "express"
import type { ApiResponse } from "../types/response"

export async function getUserFromCookie(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const parsedCookie = object({ auth: string().min(1) }).safeParse(req.cookies)

	if (!parsedCookie.success || !parsedCookie.data || parsedCookie.error) {
		return next(
			res.status(401).json({
				status: "error",
				message: "You are not signed in."
			} satisfies ApiResponse)
		)
	}

	const user = await supabase.auth.getUser(parsedCookie.data.auth)

	if (user.error) {
		return next(
			res.status(401).json({
				status: "error",
				message: "You are not signed in."
			} satisfies ApiResponse)
		)
	}

	req.user = user.data.user
	req.token = parsedCookie.data.auth
	return next()
}
