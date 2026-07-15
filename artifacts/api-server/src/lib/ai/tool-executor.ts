import { tools } from "./tool-registry";

export async function executeTool(question: string) {
  const q = question.toLowerCase();

  // Temporary routing logic
  if (
    q.includes("inspection") ||
    q.includes("critical") ||
    q.includes("active")
  ) {
    const tool = tools.find((t) => t.name === "inspection");

    if (!tool) {
      throw new Error("Inspection tool not found.");
    }

    return tool.execute(question);
  }

  return null;
}