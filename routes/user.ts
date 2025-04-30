import {Router, type Request, type Response, type NextFunction} from "express";
import multer from "multer";
import {getUserFromCookie} from "../lib/utils";
import {supabase} from "../lib/supabase";
import postgres from "../lib/postgres";
import type {ApiResponse} from "../types/response";
import type {User} from "@supabase/supabase-js";
import {number, object, string} from "zod";

const router = Router();

// --- Multer Configuration for Avatar Upload ---
const BUCKET_NAME = "avatars";
const MAX_AVATAR_SIZE_MB = 2;
const avatarUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: MAX_AVATAR_SIZE_MB * 1024 * 1024, // 2MB
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith("image/")) {
			cb(null, true);
		} else {
			cb(new Error("Invalid file type. Only images are allowed."));
		}
	},
});


// --- Route to Upload/Update Avatar ---
router.post(
	"/avatar",
	getUserFromCookie,
	avatarUpload.single("avatar"),
	async (req: Request, res: Response, next: NextFunction) => {
		const user = req.user as User;
		const file = req.file;

		if (!file) {
			res.status(400).json({
				status: "error",
				message: "No avatar file provided in 'avatar' field.",
			} satisfies ApiResponse);
			return
		}

		// --- Start of main logic ---
		try {
			// 2. Get current avatar URL
			const userResult = await postgres.query(
				`SELECT avatar_url
         FROM public."user"
         WHERE id = $1`,
				[user.id]
			);
			const currentAvatarUrl = userResult.rows[0]?.avatar_url;
			let oldFilePathInBucket: string | null = null;

			if (currentAvatarUrl) {
				try {
					const url = new URL(currentAvatarUrl);
					const pathParts = url.pathname.split('/');
					const bucketNameIndex = pathParts.indexOf(BUCKET_NAME);
					if (bucketNameIndex !== -1 && bucketNameIndex < pathParts.length - 1) {
						oldFilePathInBucket = pathParts.slice(bucketNameIndex + 1).join('/');
					} else {
						console.warn(`[User ${user.id}] Could not find '${BUCKET_NAME}' or path in URL:`, url.pathname);
					}
				} catch (urlError) {
					console.warn(`[User ${user.id}] Could not parse existing avatar URL:`, currentAvatarUrl, urlError);
				}
			}

			// 3. Delete old file
			if (oldFilePathInBucket) {
				const {error: deleteError} = await supabase.storage
					.from(BUCKET_NAME)
					.remove([oldFilePathInBucket]);
				if (deleteError && deleteError.message !== 'The resource was not found') {
					console.error(`[User ${user.id}] Error removing old avatar:`, deleteError);
				} else {
					console.log(`[User ${user.id}] Remove status (NoError/NotFound): ${!deleteError || deleteError.message === 'The resource was not found'}`);
				}
			}

			// 4. Construct new path and upload
			const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "png";
			const newFilePathInBucket = `${user.id}.${fileExt}`;
			const {error: uploadError} = await supabase.storage
				.from(BUCKET_NAME)
				.upload(newFilePathInBucket, file.buffer, {contentType: file.mimetype, upsert: true});

			if (uploadError) {
				console.error(`[User ${user.id}] Supabase upload error:`, uploadError);
				throw new Error("Failed to upload new avatar to storage.");
			}

			// 5. Get Public URL
			const {data: urlData, error: urlError} = supabase.storage
				.from(BUCKET_NAME)
				.getPublicUrl(newFilePathInBucket);

			if (urlError || !urlData || !urlData.publicUrl) {
				console.error(`[User ${user.id}] Failed to get public URL:`, urlError);
				throw new Error("Could not retrieve public URL for the uploaded avatar.");
			}
			const newAvatarUrl = urlData.publicUrl;

			// 6. Update DB
			await postgres.query(`UPDATE public."user"
                            SET avatar_url = $1
                            WHERE id = $2`, [newAvatarUrl, user.id]);

			// 7. Send Success Response
			return res.status(200).json({
				status: "success", message: "Avatar uploaded successfully.", data: {avatarUrl: newAvatarUrl},
			} satisfies ApiResponse);

		} catch (error: any) {
			console.error(`[User ${user.id}] Error in avatar processing logic:`, error);
			next(error);
		}
	}
);

// --- Zod Schema for Name Update ---
const updateNameSchema = object({
	name: string({message: "Name is required"})
		.min(1, "Name is required")
		.max(150, "Name is too long (max. 150 characters)")
})

router.patch("/name", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const user = req.user as User

	// 1. Validate Request Body
	const validation = updateNameSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			status: "error",
			message: "Invalid data provided.",
			errors: validation.error.flatten()
		} satisfies ApiResponse)
		return
	}

	const {name: newName} = validation.data
	// 2. Update User Metadata in Supabase Auth
	try {
		const {data: updatedUserData, error: updateError} = await supabase.auth.admin.updateUserById(
			user.id,
			{
				user_metadata: {
					...user.user_metadata,
					name: newName
				}
			}
		)

		if (updateError) {
			console.error(`[User ${user.id}] Supabase name update error:`, updateError)
			if (updateError.message.includes("User not found")) {
				res.status(404).json({
					status: "error",
					message: "User not found during update process."
				} satisfies ApiResponse)
				return
			}
			throw new Error("Failed to update user name in authentication service.")
		}

		// 3. Send Success Response
		res.status(200).json({
			status: "success",
			message: "User name updated successfully.",
			data: {name: updatedUserData.user.user_metadata.name}
		} satisfies ApiResponse)

	} catch (error) {
		console.error(`[User ${user.id}] Error updating name:`, error)
		next(error)
	}
})

// --- Zod Schema for Age Update ---
const updateAgeSchema = object({
	age: number({required_error: "Age is required", invalid_type_error: "Age must be a number"})
		.min(14, "Age must be at least 14")
		.max(120, "Age cannot be more than 120")
})

// --- Route to Change User's Age ---
router.patch("/age", getUserFromCookie, async (req: Request, res: Response, next: NextFunction) => {
	const user = req.user as User

	// 1. Validate Request Body
	const validation = updateAgeSchema.safeParse(req.body)
	if (!validation.success) {
		res.status(400).json({
			status: "error",
			message: "Invalid data provided.",
			errors: validation.error.flatten()
		} satisfies ApiResponse)
		return
	}

	const {age: newAge} = validation.data
	// 2. Update Age in public.user table
	try {
		const result = await postgres.query(
			`UPDATE public."user"
       SET age = $1
       WHERE id = $2
       RETURNING age`,
			[newAge, user.id]
		)

		if (result.rowCount === 0) {
			res.status(404).json({
				status: "error",
				message: "User not found in public table."
			} satisfies ApiResponse)
			return
		}

		// 3. Send Success Response
		res.status(200).json({
			status: "success",
			message: "User age updated successfully.",
			data: {age: result.rows[0].age}
		} satisfies ApiResponse)

	} catch (error) {
		console.error(`[User ${user.id}] Error updating age:`, error)
		next(error)
	}
})

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error("[User Router Error Handler] Caught:", err.message);

	if (err instanceof multer.MulterError) {
		if (err.code === 'LIMIT_FILE_SIZE') {
			res.status(400).json({status: "error", message: `File too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.`});
			return;
		}
		res.status(400).json({status: "error", message: `File upload error: ${err.message}`});
		return;
	} else if (err.message === 'Invalid file type. Only images are allowed.') {
		res.status(400).json({status: "error", message: err.message});
		return;
	}
	next(err);
});


export default router;