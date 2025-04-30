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
      console.log(`[User ${user.id}] Fetching current avatar URL...`);
      const userResult = await postgres.query(
        `SELECT avatar_url
         FROM public."user"
         WHERE id = $1`,
        [user.id]
      );
      const currentAvatarUrl = userResult.rows[0]?.avatar_url;
      let oldFilePathInBucket: string | null = null;
      console.log(`[User ${user.id}] Current URL: ${currentAvatarUrl}`);

      if (currentAvatarUrl) {
        try {
          const url = new URL(currentAvatarUrl);
          const pathParts = url.pathname.split('/');
          const bucketNameIndex = pathParts.indexOf(BUCKET_NAME);
          if (bucketNameIndex !== -1 && bucketNameIndex < pathParts.length - 1) {
            oldFilePathInBucket = pathParts.slice(bucketNameIndex + 1).join('/');
            console.log(`[User ${user.id}] Extracted old path: ${oldFilePathInBucket}`);
          } else {
            console.warn(`[User ${user.id}] Could not find '${BUCKET_NAME}' or path in URL:`, url.pathname);
          }
        } catch (urlError) {
          console.warn(`[User ${user.id}] Could not parse existing avatar URL:`, currentAvatarUrl, urlError);
        }
      }

      // 3. Delete old file
      if (oldFilePathInBucket) {
        console.log(`[User ${user.id}] Attempting remove: ${oldFilePathInBucket}`);
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
      console.log(`[User ${user.id}] Attempting upload to: ${newFilePathInBucket}`);
      const {error: uploadError} = await supabase.storage
        .from(BUCKET_NAME)
        .upload(newFilePathInBucket, file.buffer, {contentType: file.mimetype, upsert: true});

      if (uploadError) {
        console.error(`[User ${user.id}] Supabase upload error:`, uploadError);
        throw new Error("Failed to upload new avatar to storage.");
      }
      console.log(`[User ${user.id}] Upload successful.`);

      // 5. Get Public URL
      console.log(`[User ${user.id}] Getting public URL for: ${newFilePathInBucket}`);
      const {data: urlData, error: urlError} = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(newFilePathInBucket);

      if (urlError || !urlData || !urlData.publicUrl) {
        console.error(`[User ${user.id}] Failed to get public URL:`, urlError);
        throw new Error("Could not retrieve public URL for the uploaded avatar.");
      }
      const newAvatarUrl = urlData.publicUrl;
      console.log(`[User ${user.id}] Got Public URL: ${newAvatarUrl}`);

      // 6. Update DB
      console.log(`[User ${user.id}] Updating database...`);
      await postgres.query(`UPDATE public."user"
                            SET avatar_url = $1
                            WHERE id = $2`, [newAvatarUrl, user.id]);
      console.log(`[User ${user.id}] Database update successful.`);

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