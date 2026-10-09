import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import multer from "multer";
import { ZodError } from "zod";
import { Role } from "@creditsea/shared";
import { Loan, User } from "./models";
import { env } from "./config";

export type AuthRequest = Request & { actor?: { id: string; role: Role } };
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
  }
}
export const run =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({
    success: true,
    data: JSON.parse(
      JSON.stringify(data, (key, value) =>
        key === "storageKey" || key === "passwordHash" ? undefined : value,
      ),
    ),
  });
export const id = (raw: string | string[]) => {
  if (typeof raw !== "string" || !mongoose.isValidObjectId(raw))
    throw new HttpError(400, "INVALID_ID", "Invalid identifier.");
  return raw;
};
export const actor = (req: AuthRequest) => {
  if (!req.actor)
    throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  return req.actor;
};
export const invalidState = async (raw: string | string[], message: string) => {
  if (!(await Loan.exists({ _id: id(raw) })))
    throw new HttpError(404, "NOT_FOUND", "Loan not found.");
  throw new HttpError(409, "INVALID_LOAN_STATE", message);
};
export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  Promise.resolve()
    .then(async () => {
      const token = req.cookies?.creditsea_token;
      if (!token)
        throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
      let decoded: jwt.JwtPayload | string;
      try {
        decoded = jwt.verify(token, env.JWT_SECRET);
      } catch {
        throw new HttpError(
          401,
          "UNAUTHENTICATED",
          "Session expired. Please sign in.",
        );
      }
      if (typeof decoded === "string" || !decoded.sub)
        throw new HttpError(401, "UNAUTHENTICATED", "Invalid session.");
      const user = await User.findById(decoded.sub);
      if (!user)
        throw new HttpError(401, "UNAUTHENTICATED", "Invalid session.");
      req.actor = { id: String(user._id), role: user.role as Role };
      res.locals.user = user;
      next();
    })
    .catch(next);
};
export const requireRole =
  (...roles: Role[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction) =>
    roles.includes(actor(req).role)
      ? next()
      : next(
          new HttpError(
            403,
            "FORBIDDEN",
            "You do not have access to this module.",
          ),
        );
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export const originGuard = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== env.FRONTEND_URL
  )
    return next(
      new HttpError(403, "INVALID_ORIGIN", "Request origin is not allowed."),
    );
  next();
};
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError)
    return res
      .status(400)
      .json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input.",
          details: error.issues,
        },
      });
  if (error instanceof multer.MulterError)
    return res
      .status(413)
      .json({
        success: false,
        error: { code: "UPLOAD_ERROR", message: error.message, details: null },
      });
  if (error instanceof HttpError)
    return res
      .status(error.status)
      .json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
  console.error("Request failed:", error);
  return res
    .status(500)
    .json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        details: null,
      },
    });
};
