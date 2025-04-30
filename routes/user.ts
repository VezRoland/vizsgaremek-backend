// routes/user.ts
import {Router, type Request, type Response, type NextFunction} from "express";
import multer from "multer";
import {getUserFromCookie} from "../lib/utils";
import {supabase} from "../lib/supabase";
import postgres from "../lib/postgres";
import type {ApiResponse} from "../types/response";
import type {User} from "@supabase/supabase-js";

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
  getUserFromCookie, // First, authenticate
  avatarUpload.single("avatar"), // Apply Multer middleware directly
  // Main route handler (runs if Multer succeeds)
  async (req: Request, res: Response, next: NextFunction) => {
    // This handler now assumes Multer processing was successful *or*
    // Multer errors will be caught by the error handler middleware below.
    const user = req.user as User;
    const file = req.file;

    // File might still be missing if not sent, although Multer might handle this.
    // Adding a check here is safe.
    if (!file) {
      // If Multer didn't error but file is still missing, it's a bad request.
      return res.status(400).json({
        status: "error",
        message: "No avatar file provided in 'avatar' field.",
      } satisfies ApiResponse);
    }

    // --- Start of main logic ---
    try {
      // 2. Get current avatar URL
      console.log(`[User ${user.id}] Fetching current avatar URL...`); // LOG 1
      const userResult = await postgres.query(
        `SELECT avatar_url
         FROM public."user"
         WHERE id = $1`,
        [user.id]
      );
      const currentAvatarUrl = userResult.rows[0]?.avatar_url;
      let oldFilePathInBucket: string | null = null;
      console.log(`[User ${user.id}] Current URL: ${currentAvatarUrl}`); // LOG 2

      if (currentAvatarUrl) {
        try {
          const url = new URL(currentAvatarUrl);
          const pathParts = url.pathname.split('/');
          const bucketNameIndex = pathParts.indexOf(BUCKET_NAME);
          if (bucketNameIndex !== -1 && bucketNameIndex < pathParts.length - 1) {
            oldFilePathInBucket = pathParts.slice(bucketNameIndex + 1).join('/');
            console.log(`[User ${user.id}] Extracted old path: ${oldFilePathInBucket}`); // LOG 3
          } else {
            console.warn(`[User ${user.id}] Could not find '${BUCKET_NAME}' or path in URL:`, url.pathname);
          }
        } catch (urlError) {
          console.warn(`[User ${user.id}] Could not parse existing avatar URL:`, currentAvatarUrl, urlError);
        }
      }

      // 3. Delete old file
      if (oldFilePathInBucket) {
        console.log(`[User ${user.id}] Attempting remove: ${oldFilePathInBucket}`); // LOG 4
        const {error: deleteError} = await supabase.storage
          .from(BUCKET_NAME)
          .remove([oldFilePathInBucket]);
        if (deleteError && deleteError.message !== 'The resource was not found') {
          console.error(`[User ${user.id}] Error removing old avatar:`, deleteError);
        } else {
          console.log(`[User ${user.id}] Remove status (NoError/NotFound): ${!deleteError || deleteError.message === 'The resource was not found'}`); // LOG 5
        }
      }

      // 4. Construct new path and upload
      const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "png";
      const newFilePathInBucket = `${user.id}.${fileExt}`;
      console.log(`[User ${user.id}] Attempting upload to: ${newFilePathInBucket}`); // LOG 6
      const {error: uploadError} = await supabase.storage
        .from(BUCKET_NAME)
        .upload(newFilePathInBucket, file.buffer, {contentType: file.mimetype, upsert: true});

      if (uploadError) {
        console.error(`[User ${user.id}] Supabase upload error:`, uploadError); // Log specific error
        throw new Error("Failed to upload new avatar to storage.");
      }
      console.log(`[User ${user.id}] Upload successful.`); // LOG 7

      // 5. Get Public URL
      console.log(`[User ${user.id}] Getting public URL for: ${newFilePathInBucket}`); // LOG 8
      const {data: urlData, error: urlError} = supabase.storage // Check for error here too
        .from(BUCKET_NAME)
        .getPublicUrl(newFilePathInBucket);

      if (urlError || !urlData || !urlData.publicUrl) {
        console.error(`[User ${user.id}] Failed to get public URL:`, urlError); // Log specific error
        throw new Error("Could not retrieve public URL for the uploaded avatar.");
      }
      const newAvatarUrl = urlData.publicUrl;
      console.log(`[User ${user.id}] Got Public URL: ${newAvatarUrl}`); // LOG 9

      // 6. Update DB
      console.log(`[User ${user.id}] Updating database...`); // LOG 10
      await postgres.query(`UPDATE public."user"
                            SET avatar_url = $1
                            WHERE id = $2`, [newAvatarUrl, user.id]);
      console.log(`[User ${user.id}] Database update successful.`); // LOG 11

      // 7. Send Success Response
      return res.status(200).json({
        status: "success", message: "Avatar uploaded successfully.", data: {avatarUrl: newAvatarUrl},
      } satisfies ApiResponse);

    } catch (error: any) {
      // Catch errors from DB/Supabase interactions *within* the handler
      console.error(`[User ${user.id}] Error in avatar processing logic:`, error);
      // Pass to the *next* error handler (the one defined below or the global one)
      next(error);
    }
  }
);

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[User Router Error Handler] Caught:", err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Send and explicitly end
      res.status(400).json({ status: "error", message: `File too large. Maximum size is ${MAX_AVATAR_SIZE_MB}MB.` });
      return; // End execution here
    }
    // Send and explicitly end
    res.status(400).json({ status: "error", message: `File upload error: ${err.message}` });
    return; // End execution here
  } else if (err.message === 'Invalid file type. Only images are allowed.') {
    // Send and explicitly end
    res.status(400).json({ status: "error", message: err.message });
    return; // End execution here
  }

  // If it's not an error we handle specifically here, pass it on
  next(err);
});


export default router;