import {Router, type Request, type Response, type NextFunction} from "express";
import {object, string} from "zod";
import {getUserFromCookie} from "../lib/utils";
import postgres from "../lib/postgres";
import type {ApiResponse} from "../types/response";
import type {User} from "@supabase/supabase-js";
import {hasPermission} from "../lib/roles";

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
    return res.status(400).json({
      status: "error",
      message: "Invalid data provided.",
      errors: validation.error.flatten(),
    } satisfies ApiResponse);
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

  if (!hasPermission(user, "company", "updateName", {id: companyId})) {
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

export default router;