import {Router, type Request, type Response, type NextFunction} from "express";
import {number, object, string} from "zod";
import {getUserFromCookie} from "../lib/utils";
import postgres from "../lib/postgres";
import type {ApiResponse} from "../types/response";
import type {User} from "@supabase/supabase-js";
import {hasPermission} from "../lib/roles";
import {UserRole} from "../types/database.ts";
import {supabase} from "../lib/supabase.ts";

const router = Router();

// --- Zod Schema for Validation ---
const changeCompanyNameSchema = object({
	name: string().min(1, "Company name cannot be empty.").max(100, "Company name is too long (max. 100 characters)"),
});

// --- Route to Change Company Name ---
router.patch("/name", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const user = req.user as User;
	const companyId = user.user_metadata.company_id;

	// 1. Validate Request Body
	const validation = changeCompanyNameSchema.safeParse(req.body);
	if (!validation.success) {
		res.status(400).json({
			status: "error",
			message: "Invalid data provided.",
			errors: validation.error.flatten(),
		} satisfies ApiResponse);
		return
	}

	const {name: newCompanyName} = validation.data;

	// 2. Check Permissions (Ensure user is Owner)
	if (!companyId) {
		res.status(400).json({
			status: "error",
			message: "User is not associated with a company.",
		} satisfies ApiResponse);
		return
	}

	if (!hasPermission(user, "company", "updateName", {
		companyId: companyId,
		role: user.user_metadata.role,
		userId: user.id
	})) {
		res.status(403).json({
			status: "error",
			message: "You do not have permission to change the company name.",
		} satisfies ApiResponse);
		return
	}

	// 3. Update Company Name in Database
	try {
		const result = await postgres.query(
			"UPDATE public.company SET name = $1 WHERE id = $2 RETURNING id",
			[newCompanyName, companyId]
		);

		if (result.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "Company not found.",
			} satisfies ApiResponse);
			return
		}

		// 4. Send Success Response
		res.status(200).json({
			status: "success",
			message: "Company name updated successfully.",
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});

router.get("/users", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const requester = req.user as User
	const requesterRole = requester.user_metadata.role
	const requesterCompanyId = requester.user_metadata.company_id
	const requesterId = requester.id

	// --- Extract Query Params ---
	const nameFilter = req.query.name as string | undefined
	const page = parseInt(req.query.page as string) || 0
	const limitQuery = parseInt(req.query.limit as string)
	const limit = (isNaN(limitQuery) || limitQuery <= 0) ? 20 : limitQuery
	const isPaginated = page > 0
	const offset = isPaginated ? (page - 1) * limit : 0

	// 1. Check Permissions: Deny Employees first
	if (requesterRole === UserRole.Employee) {
		res.status(403).json({
			status: "error",
			message: "Employees do not have permission to view company users."
		} satisfies ApiResponse)
		return
	}

	// 2. Check Company Association: Return 400 if no company ID
	if (!requesterCompanyId) {
		res.status(400).json({
			status: "error",
			message: "Requesting user is not associated with a company."
		} satisfies ApiResponse)
		return
	}

	try {
		let paramIndex = 1
		const params: (string | number)[] = []
		let whereClauses: string[] = []

		whereClauses.push(`company_id = $${paramIndex++}`)
		params.push(requesterCompanyId)
		whereClauses.push(`id != $${paramIndex++}`)
		params.push(requesterId)
		whereClauses.push(`role <= $${paramIndex++}`)
		params.push(requesterRole)

		if (nameFilter) {
			whereClauses.push(`name ILIKE $${paramIndex++}`)
			params.push(`%${nameFilter}%`)
		}

		const whereString = whereClauses.join(" AND ")

		const countQuery = `SELECT COUNT(*) as total
                        FROM public."user"
                        WHERE ${whereString}`
		const countResult = await postgres.query(countQuery, params)
		const totalItems = parseInt(countResult.rows[0].total)
		const totalPages = isPaginated ? Math.ceil(totalItems / limit) : 1

		// --- Get User Data ---
		let dataQuery = `SELECT *
                     FROM public."user"
                     WHERE ${whereString}
                     ORDER BY role DESC, name ASC`
		const finalParams = [...params]

		if (isPaginated) {
			dataQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
			finalParams.push(limit)
			finalParams.push(offset)
		}

		const result = await postgres.query(dataQuery, finalParams)

		// --- Construct Response ---
		const responseData: any = {
			users: result.rows
		}

		if (isPaginated) {
			responseData.pagination = {
				totalPages,
				currentPage: page,
				limit,
				totalItems
			}
		}

		res.status(200).json({
			status: "ignore",
			message: "Company users fetched successfully.",
			data: responseData
		} satisfies ApiResponse)

	} catch (error) {
		next(error)
	}
})

router.get("/user/:userId", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const requester = req.user as User;
	const targetUserId = req.params.userId;

	const requesterId = requester.id;
	const requesterRole = requester.user_metadata.role;
	const requesterCompanyId = requester.user_metadata.company_id;

	// Admins cannot use this route as it's company-based
	if (requesterRole === UserRole.Admin || !requesterCompanyId) {
		res.status(403).json({
			status: "error",
			message: "User not associated with a company or invalid role for this action."
		} satisfies ApiResponse);
		return
	}

	try {
		// Handle Employee viewing: must be self
		if (requesterRole === UserRole.Employee && targetUserId !== requesterId) {
			res.status(403).json({
				status: "error",
				message: "Employees can only view their own data."
			} satisfies ApiResponse);
			return
		}

		// Query target user data
		const targetUserResult = await postgres.query(
			`SELECT id, hourly_wage, role, company_id, name
       FROM public."user"
       WHERE id = $1`,
			[targetUserId]
		);

		if (targetUserResult.rowCount === 0) {
			return res.status(404).json({
				status: "error",
				message: "User not found."
			} satisfies ApiResponse);
		}

		const targetUser = targetUserResult.rows[0];

		if (targetUser.company_id !== requesterCompanyId) {
			res.status(404).json({
				status: "error",
				message: "User not found."
			} satisfies ApiResponse);
			return
		}

		if (targetUser.role > requesterRole) {
			res.status(403).json({
				status: "error",
				message: "Cannot view users with a higher role."
			} satisfies ApiResponse);
			return
		}

		res.status(200).json({
			status: "ignore",
			message: "User data fetched successfully.",
			data: {
				id: targetUser.id,
				name: targetUser.name,
				hourlyWage: targetUser.hourly_wage,
				role: targetUser.role
			}
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});


router.patch("/verify/:userId", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const requester = req.user as User;
	const targetUserId = req.params.userId;

	const requesterRole = requester.user_metadata.role;
	const requesterCompanyId = requester.user_metadata.company_id;

	// 1. Check Permissions: Only Leader or Owner
	if (requesterRole !== UserRole.Leader && requesterRole !== UserRole.Owner) {
		res.status(403).json({
			status: "error",
			message: "Only Leaders or Owners can verify users."
		} satisfies ApiResponse);
		return
	}

	if (!requesterCompanyId) {
		res.status(403).json({
			status: "error",
			message: "Requesting user is not associated with a company."
		} satisfies ApiResponse);
		return
	}

	try {
		// 2. Check if target user exists and is in the same company
		const targetUserResult = await postgres.query(
			`SELECT company_id, verified
       FROM public."user"
       WHERE id = $1`,
			[targetUserId]
		);

		if (targetUserResult.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "User to verify not found."
			} satisfies ApiResponse);
			return
		}

		const targetUser = targetUserResult.rows[0];

		if (targetUser.company_id !== requesterCompanyId) {
			res.status(404).json({
				status: "error",
				message: "User to verify not found."
			} satisfies ApiResponse);
			return
		}

		// 3. Update user's verified status (only if not already verified)
		if (targetUser.verified === true) {
			res.status(200).json({
				status: "success",
				message: "User is already verified."
			} satisfies ApiResponse);
			return
		}

		const updateResult = await postgres.query(
			`UPDATE public."user"
       SET verified = true
       WHERE id = $1
         AND company_id = $2`,
			[targetUserId, requesterCompanyId]
		);

		if (updateResult.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "User not found or not in the correct company during update."
			} satisfies ApiResponse);
			return
		}

		// 4. Send Success Response
		res.status(200).json({
			status: "success",
			message: "User verified successfully."
		} satisfies ApiResponse);

	} catch (error) {
		next(error);
	}
});


// Zod schema for validation
const updateUserSchema = object({
	role: number().min(UserRole.Employee).max(UserRole.Owner).optional(),
	hourlyWage: number().min(0).optional()
}).refine(data => data.role !== undefined || data.hourlyWage !== undefined, {
	message: "At least role or hourlyWage must be provided for update."
});

router.patch("/user/:userId", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const requester = req.user as User;
	const targetUserId = req.params.userId;

	const requesterRole = requester.user_metadata.role as UserRole;
	const requesterCompanyId = requester.user_metadata.company_id;
	const requesterId = requester.id;

	// 1. Permission Checks
	if (requesterRole !== UserRole.Owner) {
		res.status(403).json({
			status: "error",
			message: "Only Owners can update user data."
		});
		return
	}
	if (!requesterCompanyId) {
		res.status(403).json({
			status: "error",
			message: "Requesting user is not associated with a company."
		});
		return
	}
	if (targetUserId === requesterId) {
		res.status(403).json({
			status: "error",
			message: "Cannot update your own role or wage via this route."
		});
		return
	}

	// 2. Validate Request Body
	const validation = updateUserSchema.safeParse(req.body);
	if (!validation.success) {
		res.status(400).json({
			status: "error",
			message: "Invalid data provided.",
			errors: validation.error.flatten(),
		});
		return
	}
	const {role: newRole, hourlyWage: newHourlyWage} = validation.data;

	if (newRole === UserRole.Admin) {
		res.status(403).json({
			status: "error",
			message: "Cannot change role to Admin via this route."
		});
		return
	}

	try {
		const {data: targetAuthUserObj, error: getAuthUserError} = await supabase.auth.admin.getUserById(targetUserId);
		if (getAuthUserError || !targetAuthUserObj?.user) {
			console.error(`[Company PATCH User] Supabase target user fetch error for ${targetUserId}:`, getAuthUserError);
			res.status(404).json({
				status: "error",
				message: "User to update not found in authentication system."
			});
			return
		}
		const currentAuthMetadata = targetAuthUserObj.user.user_metadata || {};
		const currentAuthRole = currentAuthMetadata.role as UserRole;

		const targetUserResult = await postgres.query(
			`SELECT role, company_id, hourly_wage
       FROM public."user"
       WHERE id = $1
         AND company_id = $2`,
			[targetUserId, requesterCompanyId]
		);

		if (targetUserResult.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "User to update not found in this company."
			});
			return
		}
		const targetDbProfile = targetUserResult.rows[0];
		const currentDbRole = targetDbProfile.role as UserRole;
		const currentDbHourlyWage = targetDbProfile.hourly_wage;

		if (currentDbRole === UserRole.Owner) {
			res.status(403).json({
				status: "error",
				message: "Cannot update data for other Owners."
			});
			return
		}
		if (newRole && newRole !== UserRole.Owner && currentDbRole === UserRole.Owner) {
			res.status(403).json({
				status: "error",
				message: "Owners cannot have their role changed by other Owners via this route."
			});
			return
		}


		let authMetaChanged = false;
		const newAuthMetadataUpdate: Partial<typeof currentAuthMetadata> = {};
		let roleActuallyChanging = false;

		if (newRole !== undefined && newRole !== currentAuthRole) {
			newAuthMetadataUpdate.role = newRole;
			authMetaChanged = true;
			roleActuallyChanging = true;
		}

		if (authMetaChanged) {
			const {error: updateAuthError} = await supabase.auth.admin.updateUserById(
				targetUserId,
				{user_metadata: {...currentAuthMetadata, ...newAuthMetadataUpdate}}
			);
			if (updateAuthError) {
				console.error(`[Company PATCH User] Supabase auth update error for ${targetUserId}:`, updateAuthError);
				res.status(500).json({
					status: "error",
					message: "Failed to update user role in authentication service. " + updateAuthError.message
				});
				return
			}
		}

		let wageActuallyChanging = false;
		if (newHourlyWage !== undefined && newHourlyWage !== currentDbHourlyWage) {
			const dbUpdateResult = await postgres.query(
				`UPDATE public."user"
         SET hourly_wage = $1
         WHERE id = $2
           AND company_id = $3`,
				[newHourlyWage, targetUserId, requesterCompanyId]
			);
			if (dbUpdateResult.rowCount > 0) {
				wageActuallyChanging = true;
			} else {
				console.warn(`[Company PATCH User] Hourly wage update for ${targetUserId} affected 0 rows, though user was found.`);
			}
		}

		if (!roleActuallyChanging && !wageActuallyChanging) {
			res.status(200).json({
				status: "success",
				message: "No changes detected or needed for user data."
			});
			return
		}

		const messages: string[] = [];
		if (roleActuallyChanging) messages.push("User role updated");
		if (wageActuallyChanging) messages.push("Hourly wage updated");

		res.status(200).json({
			status: "success",
			message: messages.join(" and ") + " successfully."
		});
		return

	} catch (error) {
		next(error);
	}
});


export default router;