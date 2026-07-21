import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large. Maximum size is 5 MB."
          : err.message,
    });
  }

  if (err.message === "Only image uploads are allowed.") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  const status =
    (err as Error & { status?: number }).status ?? 500;

 return res.status(status).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
}