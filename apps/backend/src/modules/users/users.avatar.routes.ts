import { Router, type RequestHandler } from "express";
import multer from "multer";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  uploadAvatarHandler,
  getAvatarHandler,
  deleteAvatarHandler,
} from "./users.avatar.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadSingleAvatar: RequestHandler = (req, res, next) => {
  upload.single("avatar")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(422).json({
        error: error.code === "LIMIT_FILE_SIZE" ? "UPLOAD_TOO_LARGE" : "UPLOAD_INVALID",
      });
      return;
    }
    next(error);
  });
};

export const usersAvatarRouter = Router();

usersAvatarRouter.post(
  "/avatar",
  rateLimit("user_avatar_upload"),
  requireAccessToken,
  uploadSingleAvatar,
  asyncHandler(uploadAvatarHandler),
);

usersAvatarRouter.post(
  "/me/avatar",
  rateLimit("user_avatar_upload_me"),
  requireAccessToken,
  uploadSingleAvatar,
  asyncHandler(uploadAvatarHandler),
);

usersAvatarRouter.get("/avatar/:id", rateLimit("user_avatar_get"), asyncHandler(getAvatarHandler));

usersAvatarRouter.delete(
  "/avatar",
  rateLimit("user_avatar_delete"),
  requireAccessToken,
  asyncHandler(deleteAvatarHandler),
);

usersAvatarRouter.delete(
  "/me/avatar",
  rateLimit("user_avatar_delete_me"),
  requireAccessToken,
  asyncHandler(deleteAvatarHandler),
);
