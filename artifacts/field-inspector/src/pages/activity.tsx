import { useListActivityEvents, getListActivityEventsQueryKey } from "@workspace/api-client-react";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "wouter";
import { Activity, PlusCircle, ArrowRightLeft, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  inspection_created: {
    label: "New Inspection Logged",
    icon: PlusCircle,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  status_changed: {
    label: "Status Changed",
    icon: ArrowRightLeft,
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

function EventRow({ event }: { event: {
  id: number;
  eventType: string;
  userId?: string | null;
  userDisplayName?: string | null;
  inspectionId: number;
  inspectionTitle: string;
  detail: string;
  createdAt: string;
} }) {
  const meta = EVENT_META[event.eventType] ?? {
    label: event.eventType,
    icon: AlertCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
  };
  const Icon = meta.icon;
  const ts = new Date(event.createdAt);

  return (
    <div className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors group">
      {/* Icon badge */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full ${meta.bg} flex items-center justify-center mt-0.5`}>
        <Icon className={`h-4 w-4 ${meta.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${meta.color}`}>
            {meta.label}
          </span>
          {event.userDisplayName && (
            <span className="text-[10px] font-mono text-muted-foreground/70">
              by {event.userDisplayName}
            </span>
          )}
        </div>

        <Link
          href={`/inspections/${event.inspectionId}`}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block mt-0.5"
        >
          {event.inspectionTitle}
        </Link>

        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.detail}</p>
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right">
        <div
          className="text-[10px] font-mono text-muted-foreground/60"
          title={format(ts, "PPpp")}
        >
          {formatDistanceToNow(ts, { addSuffix: true })}
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
          {format(ts, "HH:mm")}
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const qc = useQueryClient();
  const { data: events = [], isLoading, isError } = useListActivityEvents(
    { limit: 100 },
    {
      query: {
        queryKey: getListActivityEventsQueryKey({ limit: 100 }),
        refetchInterval: 30_000,
      },
    }
  );

  function refresh() {
    qc.invalidateQueries({ queryKey: getListActivityEventsQueryKey({ limit: 100 }) });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Team Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live feed of all inspections and status changes across your team
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2 font-mono text-xs uppercase tracking-wider">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1">
        {Object.entries(EVENT_META).map(([key, m]) => {
          const Icon = m.icon;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <Icon className={`h-3 w-3 ${m.color}`} />
              {m.label}
            </div>
          );
        })}
        <div className="ml-auto">
          Auto-refreshes every 30s
        </div>
      </div>

      {/* Feed */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="px-4 py-12 text-center text-xs text-muted-foreground font-mono animate-pulse">
            Loading activity...
          </div>
        )}
        {isError && (
          <div className="px-4 py-12 text-center text-xs text-destructive font-mono">
            Failed to load activity feed.
          </div>
        )}
        {!isLoading && !isError && events.length === 0 && (
          <div className="px-4 py-12 text-center space-y-2">
            <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground font-mono">No activity yet.</p>
            <p className="text-[10px] text-muted-foreground/60">
              New inspections and status changes will appear here in real time.
            </p>
          </div>
        )}
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>

      {events.length > 0 && (
        <p className="text-[10px] text-muted-foreground/50 text-center font-mono">
          Showing {events.length} most recent events
        </p>
      )}
    </div>
  );
}
