import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";

export function validate<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "Validation failed",
          issues: err.issues,
        });
        return;
      }

      next(err);
    }
  };
}