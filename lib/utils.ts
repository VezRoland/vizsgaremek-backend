import { supabase } from "./supabase"
import type { NextFunction, Request, Response } from "express"

import type { ApiResponse } from "../types/response"

export const getUserFromCookie = async (
	request: Request,
	response: Response,
	next: NextFunction
) => {
	const authCookie = Object.entries<string>(request.cookies || {})
		.find(([name]) => name === `sb-${process.env.SUPABASE_ID}-auth-token`)
		?.at(1)
	if (!authCookie) {
		response.status(401).json({
			status: "error",
			message: "You are not logged in. Sign into your account!"
		} satisfies ApiResponse)
		return
	}

	const accessToken = JSON.parse(
		atob(authCookie.replace("base64-", ""))
	).access_token

	const { data, error } = await supabase.auth.getUser(accessToken)
	if (error) {
		if (error.code !== "no_authorization") return next(error)

		response.status(401).json({
			status: "error",
			message: "You are not logged in. Sign into your account!"
		} satisfies ApiResponse)

		return
	}

	request.user = data.user
	next()
}
