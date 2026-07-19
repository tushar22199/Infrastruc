import { LoginSchema, RegisterSchema } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";
import { authLimiter } from "../middlewares/rateLimiter";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt";

import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);

const router: IRouter = Router();
router.post(
  "/auth/register",
  authLimiter,
  validate(RegisterSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, firstName, lastName } = req.body;

      const existing = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));

      if (existing.length > 0) {
        res.status(400).json({
          error: "Email already exists",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db
        .insert(usersTable)
        .values({
          email,
          password: hashedPassword,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          role: "INSPECTOR",
          isApproved: isUserApproved(email),
        })
        .returning();

      const token = signToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
        },
      });
    } catch (err) {
      req.log.error({ err }, "register error");
      res.status(500).json({ error: "Registration failed" });
      return;
    }
  },
);
router.post(
  "/auth/login",
  authLimiter,
  validate(LoginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));

      if (!user || !user.password) {
        res.status(401).json({
          error: "Invalid credentials",
        });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        res.status(401).json({
          error: "Invalid credentials",
        });
        return;
      }
      if (!user.isApproved) {
        res.status(403).json({
          error:
            "Your account has not been approved. Please contact an administrator.",
        });
        return;
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
        },
      });
    } catch (err) {
      req.log.error({ err }, "login error");

      res.status(500).json({
        error: "Login failed",
      });
    }
  },
);

router.post(
  "/auth/google",
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { credential } = req.body;

      if (!credential) {
        res.status(400).json({
          error: "Missing Google credential",
        });
        return;
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        res.status(401).json({
          error: "Invalid Google account",
        });
        return;
      }

      let [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, payload.email));

      if (!user) {
        const [newUser] = await db
          .insert(usersTable)
          .values({
            email: payload.email,
            firstName: payload.given_name ?? null,
            lastName: payload.family_name ?? null,
            profileImageUrl: payload.picture ?? null,
            role: "INSPECTOR",
            isApproved: isUserApproved(payload.email),
          })
          .returning();

        user = newUser;
      }
      if (!user.isApproved) {
        res.status(403).json({
          error:
            "Your account has not been approved. Please contact an administrator.",
        });
        return;
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
        },
      });
    } catch (err) {
      req.log.error({ err }, "google login error");

      res.status(500).json({
        error: "Google login failed",
      });
    }
  },
);

/**
 * Returns the configured allowlist, or null when ALLOWED_USER_IDS is not set.
 * null means the allowlist feature is disabled and all authenticated users are
 * approved automatically — the safe default when no restriction is intended.
 */
function getAllowedUserIds(): Set<string> | null {
  const raw = process.env.ALLOWED_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

function isUserApproved(identifier: string): boolean {
  const allowedIds = getAllowedUserIds();

  if (allowedIds === null) {
    return true;
  }

  return allowedIds.has(identifier.toLowerCase());
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

export default router;
