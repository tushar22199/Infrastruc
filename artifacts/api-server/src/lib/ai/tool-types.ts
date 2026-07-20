export interface ToolResult {
  tool: string;
  data: unknown;
}

export interface Tool {
  name: string;
  description: string;

  /**
   * Returns true if this tool can answer the user's question.
   */
  canHandle(question: string): boolean;

  execute(question: string): Promise<ToolResult>;
}