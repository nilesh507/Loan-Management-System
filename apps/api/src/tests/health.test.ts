import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app";

describe("health", () => {
  it("returns 503 if MongoDB is not connected", async () => {
    expect(mongoose.connection.readyState).toBe(0);
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
  });
});
