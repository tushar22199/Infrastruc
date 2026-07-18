import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

export const RegisterSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;