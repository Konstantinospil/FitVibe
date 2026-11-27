import { Router } from "express";
import { singleImageUpload } from "../../services/imageUpload.service.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  uploadAvatarHandler,
  getAvatarHandler,
  deleteAvatarHandler,
} from "./users.avatar.controller.js";

const uploadSingleAvatar = singleImageUpload("avatar");

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
