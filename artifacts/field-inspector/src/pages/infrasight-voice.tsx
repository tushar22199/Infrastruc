import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  LoaderCircle,
  MapPin,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { McpSearchError, searchInspections } from "@/lib/infrasight-mcp";

type SearchResult = Awaited<ReturnType<typeof searchInspections>>;
type SearchIssue = "auth" | "network" | "mcp" | "protocol";
type ConnectionState =
  | "unverified"
  | "checking"
  | "connected"
  | "unavailable"
  | "auth";

const PROMPTS = [
  "Show all inspections",
  "Find pavement distress",
  "Show bridge deterioration",
] as const;

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function coordinatePair(record: Record<string, unknown>): string | null {
  const latitude = record.latitude;
  const longitude = record.longitude;
  if (latitude !== undefined && longitude !== undefined) {
    const lat = displayValue(latitude);
    const lng = displayValue(longitude);
    if (lat && lng) return `${lat}, ${lng}`;
  }

  const geometry = record.geometry;
  if (
    geometry &&
    typeof geometry === "object" &&
    !Array.isArray(geometry) &&
    "type" in geometry &&
    geometry.type === "Point" &&
    "coordinates" in geometry &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  ) {
    const [lng, lat] = geometry.coordinates;
    if (
      (typeof lat === "number" || typeof lat === "string") &&
      (typeof lng === "number" || typeof lng === "string")
    ) {
      return `${lat}, ${lng}`;
    }
  }
  return null;
}

function isValidResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SearchResult>;
  return (
    typeof candidate.query === "string" &&
    typeof candidate.count === "number" &&
    Number.isFinite(candidate.count) &&
    candidate.count >= 0 &&
    Array.isArray(candidate.inspections) &&
    candidate.inspections.every(
      (inspection) =>
        inspection !== null &&
        typeof inspection === "object" &&
        !Array.isArray(inspection),
    )
  );
}

const ISSUE_COPY: Record<SearchIssue, { title: string; body: string }> = {
  auth: {
    title: "Sign-in required",
    body: "Your session token is missing or no longer accepted. Sign in again, then retry this read-only search.",
  },
  network: {
    title: "Connection interrupted",
    body: "InfraSight could not reach the inspection search service. Check your connection and retry.",
  },
  mcp: {
    title: "Search service unavailable",
    body: "The MCP inspection service returned an error. Your records were not changed.",
  },
  protocol: {
    title: "Unexpected response",
    body: "The search service response could not be read as inspection results. Retry to request a fresh response.",
  },
};

export default function InfraSightVoice() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [issue, setIssue] = useState<SearchIssue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("unverified");

  const runSearch = async (requestedQuery: string) => {
    const trimmedQuery = requestedQuery.trim();
    if (!trimmedQuery || isLoading) return;

    setQuery(trimmedQuery);
    setResult(null);
    setIssue(null);
    setIsLoading(true);
    setConnectionState("checking");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIssue("auth");
        setConnectionState("auth");
        return;
      }
      const response: unknown = await searchInspections(trimmedQuery, token);
      if (!isValidResult(response)) {
        setIssue("protocol");
        setConnectionState("unavailable");
        return;
      }
      setResult(response);
      setConnectionState("connected");
    } catch (error: unknown) {
      if (error instanceof McpSearchError) {
        setIssue(error.kind);
        setConnectionState(error.kind === "auth" ? "auth" : "unavailable");
      } else {
        setIssue("mcp");
        setConnectionState("unavailable");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-10">
      <header className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden sm:block">
          <div className="absolute right-[-3rem] top-[-6rem] h-72 w-72 rounded-full border border-primary/10" />
          <div className="absolute right-[-.5rem] top-[-2.5rem] h-56 w-56 rounded-full border border-primary/10" />
          <div className="absolute right-14 top-12 h-28 w-28 rounded-full border border-dashed border-primary/20" />
          <div className="absolute right-[7.25rem] top-[6.25rem] h-3 w-3 rounded-full bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/.12)]" />
          <div className="absolute right-10 bottom-6 font-mono text-[10px] tracking-[.22em] text-muted-foreground/40">FIELD QUERY / 01</div>
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
              <Radio className="h-3 w-3" />
              InfraSight Voice
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] ${
                connectionState === "connected"
                  ? "border-emerald-500/25 bg-emerald-500/[.07] text-emerald-300"
                  : connectionState === "unavailable"
                    ? "border-destructive/25 bg-destructive/[.07] text-destructive"
                    : "border-primary/25 bg-primary/[.07] text-primary"
              }`}
              data-testid="status-mcp-connection"
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionState === "connected"
                    ? "bg-emerald-400"
                    : connectionState === "unavailable"
                      ? "bg-destructive"
                      : "bg-primary"
                }`}
              />
              {connectionState === "connected"
                ? "MCP connected · read only"
                : connectionState === "checking"
                  ? "MCP checking · read only"
                  : connectionState === "unavailable"
                    ? "MCP unavailable · read only"
                    : connectionState === "auth"
                      ? "Sign-in needed · read only"
                      : "MCP · read only"}
            </span>
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-[2.65rem] sm:leading-[1.12]">
            Ask the field record.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Search deployed inspection records in plain language. Results come directly from the authenticated MCP service—nothing here can alter a record.
          </p>
        </div>
      </header>

      <section aria-labelledby="search-heading" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/[.08] text-primary">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h2 id="search-heading" className="text-sm font-semibold">Inspection search</h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">Natural language · read only</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Authenticated endpoint
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="inspection-query">Describe the inspections to find</label>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="inspection-query"
                data-testid="input-inspection-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Find pavement distress near the river crossing"
                className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/70 focus:ring-2 focus:ring-primary/15"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              data-testid="button-search-inspections"
              disabled={isLoading || !query.trim()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[transform,opacity,background-color] hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-36"
            >
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              {isLoading ? "Searching" : "Search records"}
            </button>
          </form>

          <div className="mt-5">
            <div className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Start with a field prompt
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPTS.map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  data-testid={`button-prompt-${index + 1}`}
                  disabled={isLoading}
                  onClick={() => void runSearch(prompt)}
                  className="group inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{prompt}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-background/35 px-5 py-3 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:px-6">
          <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" />Read-only request</span>
          <span className="inline-flex items-center gap-1.5"><Database className="h-3 w-3 text-primary" />Live inspection records</span>
          <span className="inline-flex items-center gap-1.5"><CircleHelp className="h-3 w-3" />No severity or status inference</span>
        </div>
      </section>

      <section aria-labelledby="results-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-primary">Search output</div>
            <h2 id="results-heading" className="text-xl font-semibold tracking-tight">Inspection results</h2>
          </div>
          {result && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-xs" data-testid="text-result-count">
              <span className="text-muted-foreground">MATCHES</span>
              <span className="font-semibold tabular-nums text-primary">{result.count}</span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3" role="status" aria-live="polite" data-testid="status-search-loading">
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/[.05] px-4 py-3 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Querying the inspection service…
            </div>
            {[0, 1].map((item) => (
              <div key={item} className="animate-pulse rounded-lg border border-border bg-card p-5">
                <div className="h-4 w-2/5 rounded bg-muted" />
                <div className="mt-4 h-3 w-1/4 rounded bg-muted/80" />
                <div className="mt-5 h-3 w-full rounded bg-muted/70" />
                <div className="mt-2 h-3 w-3/5 rounded bg-muted/70" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && issue && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[.06] p-5 sm:p-6" role="alert" data-testid={`status-search-${issue}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                {issue === "network" ? <WifiOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{ISSUE_COPY[issue].title}</div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{ISSUE_COPY[issue].body}</p>
                <button
                  type="button"
                  data-testid="button-retry-search"
                  onClick={() => void runSearch(query)}
                  disabled={isLoading || !query.trim()}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry search
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !issue && !result && (
          <div className="relative overflow-hidden rounded-lg border border-dashed border-border bg-card/60 px-5 py-10 text-center sm:py-14" data-testid="empty-search-state">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-36 w-72 -translate-x-1/2 rounded-full bg-primary/[.035] blur-3xl" />
            <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-primary">
              <Search className="h-5 w-5" />
            </div>
            <p className="relative mt-4 text-sm font-medium">The field log is ready.</p>
            <p className="relative mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Ask a question or choose a prompt above. Matching records will appear here exactly as returned by the service.
            </p>
          </div>
        )}

        {!isLoading && result && result.inspections.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-5 py-10 text-center sm:py-12" data-testid="empty-results-state">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <Database className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium">No matching inspection records</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              The service returned zero results for “{result.query}”. Try a broader description or another field prompt.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground" data-testid="text-empty-count">
              <span>Returned count</span><span className="text-primary">{result.count}</span>
            </div>
          </div>
        )}

        {!isLoading && result && result.inspections.length > 0 && (
          <div className="space-y-3" data-testid="list-inspection-results">
            {result.inspections.map((inspection, index) => {
              const record = inspection as Record<string, unknown>;
              const title = displayValue(record.title) ?? "Title not provided";
              const issueType = displayValue(record.issueType);
              const severity = displayValue(record.severity);
              const status = displayValue(record.status);
              const description = displayValue(record.description);
              const coordinates = coordinatePair(record);
              const recordId = displayValue(record.id) ?? `result-${index + 1}`;

              return (
                <article
                  key={`${recordId}-${index}`}
                  data-testid={`card-inspection-${index + 1}`}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/25"
                >
                  <div className="flex flex-col gap-4 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                          <span className="text-primary">FIELD RECORD</span>
                          <span className="text-border">/</span>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <h3 className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg" data-testid={`text-inspection-title-${index + 1}`}>
                          {title}
                        </h3>
                      </div>
                      {coordinates && (
                        <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[10px] text-muted-foreground" data-testid={`text-inspection-coordinates-${index + 1}`}>
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {coordinates}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        { label: "Issue type", value: issueType },
                        { label: "Severity", value: severity },
                        { label: "Status", value: status },
                      ].map((field) => (
                        <div key={field.label} className="min-w-0 rounded-md border border-border/80 bg-background/45 px-3 py-2.5">
                          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{field.label}</div>
                          <div className="mt-1 break-words text-xs font-medium text-foreground" data-testid={`text-inspection-${field.label.toLowerCase().replace(" ", "-")}-${index + 1}`}>
                            {field.value ?? "Not provided"}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border/80 pt-3">
                      <div className="mb-1 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Description</div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground" data-testid={`text-inspection-description-${index + 1}`}>
                        {description ?? "Not provided"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
