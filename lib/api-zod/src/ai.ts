import { z } from "zod";

export const InsightsSchema = z.object({
  totalInspections: z.number().int().nonnegative(),
  activeIssues: z.number().int().nonnegative(),
  regionalHealth: z.number().min(0).max(100),
  overdueInspections: z.number().int().nonnegative(),
  severityBreakdown: z.array(
    z.object({
      name: z.string(),
      value: z.number().int().nonnegative(),
    })
  ),
});

export type InsightsInput = z.infer<typeof InsightsSchema>;

export const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(12000),
      })
    )
    .min(1)
    .max(20),
});

export type ChatInput = z.infer<typeof ChatSchema>;