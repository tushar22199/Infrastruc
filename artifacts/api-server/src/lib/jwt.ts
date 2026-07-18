import jwt, { JwtPayload } from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();

export interface JwtUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "ADMIN" | "INSPECTOR" | "VIEWER";
}

export function signToken(payload: JwtUser): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtUser {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded)
  ) {
    throw new Error("Invalid token");
  }

  return decoded as JwtUser;
}