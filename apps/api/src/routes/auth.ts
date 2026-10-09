import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { registerSchema, loginSchema } from "@creditsea/shared";
import { User } from "../models";
import { env } from "../config";
import { HttpError, auth, cookieOptions, ok, run } from "../http";

const router = express.Router();
router.get(
  "/health",
  run(async (_req, res) => {
    if (mongoose.connection.readyState !== 1)
      throw new HttpError(
        503,
        "DATABASE_UNAVAILABLE",
        "Database is unavailable.",
      );
    ok(res, { database: "connected" });
  }),
);
const limitResponse = (_req: express.Request, res: express.Response) =>
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
      details: null,
    },
  });
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: limitResponse,
});
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip || "")}:${String(req.body?.email || "")
      .trim()
      .toLowerCase()}`,
  handler: limitResponse,
});
router.post(
  "/auth/register",
  authLimit,
  run(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await User.create({
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: "BORROWER",
      });
      ok(
        res,
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        201,
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(
          409,
          "EMAIL_EXISTS",
          "This email is already registered.",
        );
      throw error;
    }
  }),
);
router.post(
  "/auth/login",
  authLimit,
  loginLimit,
  run(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await User.findOne({ email: input.email }).select(
      "+passwordHash",
    );
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
      );
    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
    const payload = jwt.decode(token);
    const maxAge =
      payload && typeof payload !== "string" && payload.exp
        ? payload.exp * 1000 - Date.now()
        : 0;
    res.cookie("creditsea_token", token, {
      ...cookieOptions,
      maxAge,
    });
    user.lastLoginAt = new Date();
    await user.save();
    ok(res, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }),
);
router.post("/auth/logout", (_req, res) => {
  res.clearCookie("creditsea_token", cookieOptions);
  ok(res, { loggedOut: true });
});
router.get(
  "/auth/me",
  auth,
  run(async (_req, res) => {
    const u = res.locals.user;
    ok(res, { id: u.id, email: u.email, fullName: u.fullName, role: u.role });
  }),
);

export default router;
