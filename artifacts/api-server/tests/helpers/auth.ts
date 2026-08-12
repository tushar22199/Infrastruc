import { signToken, type JwtUser } from "../../src/lib/jwt";

export function createTestUser(
  role: JwtUser["role"] = "VIEWER"
): JwtUser {
  return {
    id: "test-user",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    profileImageUrl: null,
    role,
  };
}

export function createToken(
  role: JwtUser["role"] = "VIEWER"
) {
  return signToken(createTestUser(role));
}