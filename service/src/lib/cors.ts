import cors from "cors";
import { requireEnv } from "./env.js";

/**
 * ALLOWED_ORIGINS is a comma-separated list (mirrors caught-looking's
 * CORS_ALLOWED_ORIGINS convention) — e.g. "https://www.danibsheehan.com,http://localhost:5173"
 * so local dev against a deployed backend doesn't require a redeploy to allow.
 */
function parseAllowedOrigins(): string[] {
  return requireEnv("ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const allowedOrigins = parseAllowedOrigins();

export const corsMiddleware = cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
