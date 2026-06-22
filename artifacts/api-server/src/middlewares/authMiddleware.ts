import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      user?: any;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function () {
    return !!this.user;
  };

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    req.user = verifyToken(token);
  } catch {
    req.user = undefined;
  }

  next();
}
