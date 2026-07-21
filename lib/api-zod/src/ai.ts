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