import { supabase } from "./supabase"
import type { NextFunction, Request, Response } from "express"

export const getUserFromCookie = async (
	request: Request,
	response: Response,
	next: NextFunction
) => {
	const authCookie = Object.entries<string>(request.cookies)
		.find(([name]) => name.match(/sb-.+-auth-token/))
		?.at(1)
	if (!authCookie)
		return next(response.status(401).json({ error: "No auth token provided" }))

	const accessToken = JSON.parse(
		atob(authCookie.replace("base64-", ""))
	).access_token

	const { data, error } = await supabase.auth.getUser(accessToken)
	if (error)
		return next(response.status(401).json({ error: "Authorization failed" }))

	request.user = data.user
	next()
}
