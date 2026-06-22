import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export function signToken(payload: { id: string; email: string | null }) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    id: string;
    email: string | null;
  };
}
