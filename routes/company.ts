import {Router, type Request, type Response, type NextFunction} from "express";
import {number, object, string} from "zod";
import {getUserFromCookie} from "../lib/utils";
import postgres from "../lib/postgres";
import type {ApiResponse} from "../types/response";
import type {User} from "@supabase/supabase-js";
import {hasPermission} from "../lib/roles";
import {UserRole} from "../types/database.ts";

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

  if (!hasPermission(user, "company", "updateName", {companyId: companyId, role: user.user_metadata.role, userId: user.id})) {
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
  const requester = req.user as User;
  const companyId = requester.user_metadata.company_id;
  const requesterRole = requester.user_metadata.role;
  const requesterId = requester.id;

  // 1. Check Permissions: Deny Employees
  if (!hasPermission(requester, "company", "view", {companyId: companyId, role: requesterRole, userId: requesterId}) || requester.user_metadata.role === UserRole.Employee) {
    res.status(403).json({
      status: "error",
      message: "You do not have permission to view company users."
    } satisfies ApiResponse);
    return
  }

  try {
    // 2. Query Users: In same company, not the requester, at or below requester's rank
    const result = await postgres.query(
      `SELECT id, name, role, avatar_url, verified
       FROM public."user"
       WHERE company_id = $1
         AND id != $2
         AND role <= $3
       ORDER BY role DESC, name ASC`,
      [companyId, requesterId, requesterRole]
    );

    // 3. Return results
    res.status(200).json({
      status: "success",
      message: "Company users fetched successfully.",
      data: result.rows
    } satisfies ApiResponse<typeof result.rows>);

  } catch (error) {
    next(error);
  }
});

router.get("/user/:userId", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
  const requester = req.user as User;
  const targetUserId = req.params.userId;

  const requesterRole = requester.user_metadata.role;
  const requesterCompanyId = requester.user_metadata.company_id;

  try {
    if (!hasPermission(requester, "company", "view", {companyId: requesterCompanyId, role: requesterRole, userId: targetUserId})) {
      res.status(403).json({
        status: "error",
        message: "You do not have permission to view this user's data."
      } satisfies ApiResponse);
      return
    }

    // Query target user data
    const targetUserResult = await postgres.query(
      `SELECT id, hourly_wage, role, company_id
       FROM public."user"
       WHERE id = $1`,
      [targetUserId]
    );

    if (targetUserResult.rowCount === 0) {
      res.status(404).json({
        status: "error",
        message: "User not found."
      } satisfies ApiResponse);
      return
    }

    if (!hasPermission(requester, "company", "view", {companyId: targetUserResult.rows[0].companyId, role: targetUserResult.rows[0].role, userId: targetUserId})) {
      res.status(403).json({
        status: "error",
        message: "You do not have permission to view this user's data."
      } satisfies ApiResponse);
      return
    }

    const targetUser = targetUserResult.rows[0];

    res.status(200).json({
      status: "success",
      message: "User data fetched successfully.",
      data: {
        id: targetUser.id,
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
  if (!hasPermission(requester, "company", "verify", {companyId: requesterCompanyId, role: requesterRole, userId: targetUserId})) {
    res.status(403).json({
      status: "error",
      message: "Only Leaders or Owners can verify users."
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

    if (targetUserResult.rows[0].company_id !== requesterCompanyId) {
      res.status(403).json({
        status: "error",
        message: "Cannot verify users outside your company."
      } satisfies ApiResponse);
      return
    }

    if (targetUserResult.rows[0].verified) {
      res.status(400).json({
        status: "error",
        message: "User is already verified."
      } satisfies ApiResponse);
      return
    }

    // 3. Update user's verified status
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
  role: number().min(UserRole.Employee).max(UserRole.Admin).optional(),
  hourlyWage: number().min(0).optional()
}).refine(data => data.role !== undefined || data.hourlyWage !== undefined, {
  message: "At least role or hourlyWage must be provided for update."
});

router.patch("/user/:userId", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
  const requester = req.user as User;
  const targetUserId = req.params.userId;

  const requesterRole = requester.user_metadata.role;
  const requesterCompanyId = requester.user_metadata.company_id;
  const requesterId = requester.id;

  // 1. Check Permissions: Only Owner
  if (!hasPermission(requester, "company", "update", {companyId: requesterCompanyId, role: requesterRole, userId: targetUserId})) {
    res.status(403).json({
      status: "error",
      message: "Only Owners can update user data."
    } satisfies ApiResponse);
    return
  }

  // Prevent self-update via this route
  if (targetUserId === requesterId) {
    res.status(403).json({
      status: "error",
      message: "Cannot update your own role or wage via this route."
    } satisfies ApiResponse);
    return
  }

  // 2. Validate Request Body
  const validation = updateUserSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid data provided.",
      errors: validation.error.flatten(),
    } satisfies ApiResponse);
    return
  }

  const {role: newRole, hourlyWage: newHourlyWage} = validation.data;

  if (newRole === 4 ) {
    res.status(400).json({
      status: "error",
      message: "Cannot set role to Administrator."
    } satisfies ApiResponse);
    return
  }

  try {
    // 3. Fetch target user to check company and current role
    const targetUserResult = await postgres.query(
      `SELECT role, company_id
       FROM public."user"
       WHERE id = $1`,
      [targetUserId]
    );

    if (targetUserResult.rowCount === 0) {
      res.status(404).json({
        status: "error",
        message: "User to update not found."
      } satisfies ApiResponse);
      return
    }

    const targetUser = targetUserResult.rows[0];

    // 4. Verify target is in the same company and not an Owner
    if (!hasPermission(requester, "company", "update", {companyId: targetUser.company_id, role: targetUser.role, userId: targetUserId})) {
      res.status(403).json({
        status: "error",
        message: "Cannot update users outside your company."
      } satisfies ApiResponse);
      return
    }
    if (targetUser.role === UserRole.Owner) {
      return res.status(403).json({
        status: "error",
        message: "Cannot update data for other Owners."
      } satisfies ApiResponse);
    }


    // 5. Build and Execute Update Query
    const updates: string[] = [];
    const params: (string | number | null)[] = [targetUserId, requesterCompanyId];
    let paramIndex = 3;

    if (newRole !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(newRole);
    }
    if (newHourlyWage !== undefined) {
      updates.push(`hourly_wage = $${paramIndex++}`);
      params.push(newHourlyWage);
    }

    if (updates.length === 0) {
      res.status(400).json({
        status: "error",
        message: "No update data provided."
      } satisfies ApiResponse);
      return
    }

    const updateQuery = `
        UPDATE public."user"
        SET ${updates.join(", ")}
        WHERE id = $1
          AND company_id = $2
    `;

    const updateResult = await postgres.query(updateQuery, params);

    if (updateResult.rowCount === 0) {
      res.status(404).json({
        status: "error",
        message: "User not found or not in company during final update."
      } satisfies ApiResponse);
      return
    }

    // 6. Send Success Response
    res.status(200).json({
      status: "success",
      message: "User data updated successfully."
    } satisfies ApiResponse);

  } catch (error) {
    next(error);
  }
});


export default router;