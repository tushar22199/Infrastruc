import type { Tool } from "../tool-types";
import { retrieveRelevantInspections } from "../retriever/inspection-retriever";

const inspectionTool: Tool = {
  name: "inspection",

  description:
    "Retrieve infrastructure inspections using issue type, status, severity, latest, and report filters.",

  canHandle(question: string) {
    const q = question.toLowerCase();

    return (
      q.includes("inspection") ||
      q.includes("critical") ||
      q.includes("active") ||
      q.includes("latest") ||
      q.includes("recent") ||
      q.includes("report") ||
      q.includes("summary") ||
      q.includes("audit") ||
      q.includes("maintenance") ||
      q.includes("bridge") ||
      q.includes("road") ||
      q.includes("pavement") ||
      q.includes("drain") ||
      q.includes("drainage") ||
      q.includes("structural") ||
      q.includes("sign") ||
      q.includes("erosion") ||
      q.includes("utility")
    );
  },

  async execute(question: string) {
    const data = await retrieveRelevantInspections(question);

    return {
      tool: "inspection",
      data,
    };
  },
};

export default inspectionTool;