import { logger } from "../lib/logger";
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import type { JwtUser } from "../lib/jwt";
declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
       user?: JwtUser;
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
export function authorize(
  allowedRoles: JwtUser["role"][],
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
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


export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
 

  req.isAuthenticated = function () {
    return this.user !== undefined;
  };

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.substring(7).trim();
    req.user = verifyToken(token);
  } catch (err) {
    logger.warn(
      { err },
      "JWT verification failed"
    );

    req.user = undefined;
  }

  next();
}
