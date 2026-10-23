import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler, isNonEmptyString } from "../utils.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Email and password are required",
      );
    }
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+passwordHash");
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok)
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Incorrect email or password",
      );
    if (!user.isActive)
      throw new ApiError(403, "DEACTIVATED", "This account is deactivated");

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });
    res.json({ data: { token, user } });
  }),
);

router.get("/me", requireAuth, (req, res) => res.json({ data: req.user }));

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+passwordHash");

    if (name !== undefined) {
      if (!isNonEmptyString(name, 100))
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid name");
      user.name = name.trim();
    }
    if (newPassword !== undefined) {
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "New password must be at least 6 characters",
        );
      }
      if (
        !currentPassword ||
        !(await bcrypt.compare(currentPassword, user.passwordHash))
      ) {
        throw new ApiError(
          400,
          "WRONG_PASSWORD",
          "Current password is incorrect",
        );
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }
    await user.save();
    res.json({ data: user });
  }),
);

export default router;
