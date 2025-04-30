import type { CookieOptions } from "express";

export const COOKIE_OPTIONS: CookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "none"
};

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
	...COOKIE_OPTIONS,
	maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};