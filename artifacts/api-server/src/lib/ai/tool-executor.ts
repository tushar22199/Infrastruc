import { tools } from "./tool-registry";

export async function executeTool(question: string) {
  const tool = tools.find((tool) => tool.canHandle(question));

  if (!tool) {
    return null;
  }

  return tool.execute(question);
}