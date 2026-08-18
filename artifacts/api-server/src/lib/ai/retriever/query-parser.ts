import { issueTypeSynonyms } from "./synonyms";
import {
 
  statusEnum,
} from "@workspace/db";

export interface QueryFilters {
  issueType?: string;
  status?: string;
  severity?: string;
  latest?: boolean;
  report?: boolean;
}

export function parseQuery(question: string): QueryFilters {
  const q = question.toLowerCase();

  const filters: QueryFilters = {};

  // Issue Type
  const issueTypeMatches = Object.entries(issueTypeSynonyms)
    .flatMap(([issueType, synonyms]) =>
      synonyms
        .filter((term) => q.includes(term.toLowerCase()))
        .map((term) => ({
          issueType,
          term,
          length: term.length,
        }))
    )
    .sort((a, b) => b.length - a.length);

  if (issueTypeMatches.length > 0) {
    filters.issueType = issueTypeMatches[0].issueType;
  }
  // Status
  const status = statusEnum.find((value) =>
    q.includes(value.toLowerCase())
  );

  if (status) {
    filters.status = status;
  }

  // Severity
  if (q.includes("critical")) {
    filters.severity = "Critical";
  } else if (q.includes("high")) {
    filters.severity = "High";
  } else if (q.includes("medium")) {
    filters.severity = "Medium";
  } else if (q.includes("low")) {
    filters.severity = "Low";
  }

  // Latest
  if (q.includes("latest") || q.includes("recent")) {
    filters.latest = true;
  }

  // Report
  if (
    q.includes("report") ||
    q.includes("summary") ||
    q.includes("audit")
  ) {
    filters.report = true;
  }

  return filters;
}