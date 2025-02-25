import { supabase } from "./supabase"
import type { NextFunction, Request, Response } from "express"

import type { ServerResponse } from "../types/response"

export const getUserFromCookie = async (
	request: Request,
	response: Response,
	next: NextFunction
) => {
	const authCookie = Object.entries<string>(request.cookies || {})
		.find(([name]) => name === `sb-${process.env.SUPABASE_ID}-auth-token`)
		?.at(1)
	if (!authCookie)
		return next(
			response.status(401).json({
				error: true,
				type: "message",
				message: "Ön nincs bejelentkezve. Lépjen be fiókjába!",
				messageType: "info"
			} satisfies ServerResponse)
		)

	const accessToken = JSON.parse(
		atob(authCookie.replace("base64-", ""))
	).access_token

	const { data, error } = await supabase.auth.getUser(accessToken)
	if (error)
		return next(
			response.status(401).json({
				error: true,
				type: "message",
				message: "Ön nincs bejelentkezve. Lépjen be fiókjába!",
				messageType: "info"
			} satisfies ServerResponse)
		)

	request.user = data.user
	next()
}
