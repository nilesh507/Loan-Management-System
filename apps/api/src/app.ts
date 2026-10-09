import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config";
import { errorHandler, HttpError, originGuard } from "./http";
import authRoutes from "./routes/auth";
import borrowerRoutes from "./routes/borrower";
import operationsRoutes from "./routes/operations";

const app = express();
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(originGuard);
app.use("/api/v1", authRoutes, borrowerRoutes);
app.use("/api/v1/operations", operationsRoutes);
app.use((_req, _res, next) =>
  next(new HttpError(404, "NOT_FOUND", "Endpoint not found.")),
);
app.use(errorHandler);
export default app;
