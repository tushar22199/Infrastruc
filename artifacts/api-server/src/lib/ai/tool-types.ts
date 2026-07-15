export interface ToolResult {
  tool: string;
  data: unknown;
}

export interface Tool {
  name: string;

  description: string;

  execute(
    question: string,
  ): Promise<ToolResult>;
}