import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const googleClient = new OAuth2Client(
  "368629552310-hj6paovh03h7dko2s66omr35qgvkoh84.apps.googleusercontent.com",
);

const router: IRouter = Router();
router.post(
  "/auth/register",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: "Email and password are required",
        });
        return;
      }
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
          isApproved: true,
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: "Email and password are required",
        });
        return;
      }

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
        audience:
          "368629552310-hj6paovh03h7dko2s66omr35qgvkoh84.apps.googleusercontent.com",
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
            isApproved: true,
          })
          .returning();

        user = newUser;
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

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

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

async function upsertUser(claims: Record<string, unknown>) {
  const userId = claims.sub as string;
  const allowedIds = getAllowedUserIds();
  // When no allowlist is configured, approve every authenticated user.
  // When an allowlist is configured, only listed IDs receive approval.
  const isApproved = allowedIds === null ? true : allowedIds.has(userId);

  const profileData = {
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values({
      id: userId,
      ...profileData,
      isApproved,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...profileData,
        // Grant approval when approved; never revoke an existing approval
        // (preserves manually-set DB rows and allowlist removals gracefully).
        isApproved: isApproved ? true : usersTable.isApproved,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response): Promise<void> => {
  if (!process.env.REPL_ID) {
    res.status(503).json({
      message: "Authentication disabled",
    });
    return;
  }

  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  if (!process.env.REPL_ID) {
    return res.redirect("/");
  }

  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

  if (!dbUser.isApproved) {
    res
      .status(403)
      .send(
        "Access denied. Your account has not been approved for this application. Contact your administrator.",
      );
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.post("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.json({ redirectUrl: endSessionUrl.href });
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      if (ISSUER_URL) {
        callbackUrl.searchParams.set("iss", ISSUER_URL);
      }

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      if (!dbUser.isApproved) {
        res.status(403).json({
          error:
            "Access denied. Your account has not been approved for this application.",
        });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
