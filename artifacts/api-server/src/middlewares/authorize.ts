import { Request, Response, NextFunction } from "express";

type Role = "ADMIN" | "INSPECTOR" | "VIEWER";

export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
      });
      return;
    }

    next();
  };
}
