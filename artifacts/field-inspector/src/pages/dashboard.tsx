import { useGetDashboardSummary, useGetByType, useGetBySeverity, useListInspections, useGetHotspots, useGetOverdueReinspections, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, Activity, LayoutDashboard, Flame, MapPin, RefreshCw, Clock } from "lucide-react";
import { exportAuditReport } from "@/lib/pdf-export";
import { DevTestingPanel } from "@/components/dev-testing-panel";
import { useDevPanelEnabled } from "@/lib/dev-mode";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: typeBreakdown, isLoading: isLoadingTypes } = useGetByType();
  const { data: severityBreakdown, isLoading: isLoadingSeverities } = useGetBySeverity();
  const { data: inspections, isLoading: isLoadingInspections } = useListInspections();
  const { data: hotspots } = useGetHotspots();
  const { data: overdueItems } = useGetOverdueReinspections();
  const devPanelEnabled = useDevPanelEnabled();

  const handleExport = () => {
    if (summary && inspections) {
      exportAuditReport(summary, inspections);
    }
  };

  if (isLoadingSummary || isLoadingTypes || isLoadingSeverities || isLoadingInspections) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const recentInspections = inspections ? [...inspections].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5) : [];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Command Center
          </h1>
          <p className="text-muted-foreground mt-1">Infrastructure auditor overview and regional health metrics.</p>
        </div>
        <Button onClick={handleExport} disabled={!summary || !inspections} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider">
          <Download className="mr-2 h-4 w-4" />
          Export Audit Report
        </Button>
      </div>

      {devPanelEnabled && <DevTestingPanel />}

      {/* Hotspot Alerts */}
      {hotspots && hotspots.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-destructive text-sm">
              {hotspots.length} Critical Hotspot{hotspots.length > 1 ? "s" : ""} Detected
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Clusters of active Critical inspections within {hotspots[0]?.radiusKm ?? 10} km
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotspots.map((h) => (
              <Link key={h.id} href={`/map?hotspot=${h.id}&lat=${h.centerLat}&lng=${h.centerLng}`}>
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-card p-3 hover:border-destructive/60 transition-colors cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                    <span className="text-destructive font-bold font-mono text-sm">{h.count}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mb-1">
                      <MapPin className="h-3 w-3" />
                      <span>{h.centerLat.toFixed(4)}, {h.centerLng.toFixed(4)}</span>
                    </div>
                    <ul className="space-y-0.5">
                      {h.titles.slice(0, 2).map((title, i) => (
                        <li key={i} className="text-xs text-foreground truncate">{title}</li>
                      ))}
                      {h.titles.length > 2 && (
                        <li className="text-xs text-muted-foreground">+{h.titles.length - 2} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Re-inspection Alerts */}
      {overdueItems && overdueItems.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            <span className="font-bold uppercase tracking-wider text-amber-500 text-sm">
              {overdueItems.length} Overdue Re-inspection{overdueItems.length > 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">Scheduled re-inspections past their due date</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueItems.map((item) => (
              <Link key={item.id} href={`/inspections/${item.id}`}>
                <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-card p-3 hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{item.title}</div>
                    <div className="text-[10px] font-mono text-amber-500 mt-0.5 capitalize">{item.reinspectionInterval} · {item.daysOverdue}d overdue</div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                      item.severity === "Critical" ? "text-destructive" : item.severity === "Medium" ? "text-primary" : "text-green-500"
                    }`}>{item.severity}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground font-mono">{summary?.totalLogs || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary font-mono">{summary?.activeIssues || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Regional Health</CardTitle>
            <CheckCircle className={`h-4 w-4 ${(summary?.regionalHealthScore || 0) > 75 ? "text-green-500" : (summary?.regionalHealthScore || 0) > 50 ? "text-primary" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold font-mono ${(summary?.regionalHealthScore || 0) > 75 ? "text-green-500" : (summary?.regionalHealthScore || 0) > 50 ? "text-primary" : "text-destructive"}`}>
              {summary?.regionalHealthScore || 0}<span className="text-2xl text-muted-foreground">/100</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider">Issues by Severity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {severityBreakdown?.map((item) => {
              const max = Math.max(...(severityBreakdown.map(s => s.count) || [1]));
              const percent = (item.count / max) * 100;
              const colorClass = item.severity === 'Critical' ? 'bg-destructive' : item.severity === 'Medium' ? 'bg-primary' : 'bg-green-500';
              
              return (
                <div key={item.severity} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium uppercase text-muted-foreground tracking-wider">{item.severity}</span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${colorClass}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {(!severityBreakdown || severityBreakdown.length === 0) && (
              <div className="text-muted-foreground text-sm text-center py-4">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider">Issues by Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeBreakdown?.map((item) => {
              const max = Math.max(...(typeBreakdown.map(s => s.count) || [1]));
              const percent = (item.count / max) * 100;
              
              return (
                <div key={item.issueType} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground uppercase tracking-wider text-xs truncate max-w-[200px]">{item.issueType}</span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {(!typeBreakdown || typeBreakdown.length === 0) && (
              <div className="text-muted-foreground text-sm text-center py-4">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border shadow-md">
        <CardHeader>
          <CardTitle className="uppercase tracking-wider">Recent Inspections</CardTitle>
          <CardDescription>Latest infrastructure reports from the field.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentInspections.length > 0 ? (
              recentInspections.map((inspection) => (
                <div key={inspection.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-secondary/50 border border-secondary-border hover:bg-secondary transition-colors">
                  <div className="space-y-1">
                    <Link href={`/inspections/${inspection.id}`} className="font-semibold text-lg hover:text-primary transition-colors">
                      {inspection.title}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span>{inspection.issueType}</span>
                      <span>•</span>
                      <span>{format(new Date(inspection.createdAt), "MMM d, yyyy HH:mm")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      inspection.severity === 'Critical' ? 'bg-destructive/20 text-destructive' : 
                      inspection.severity === 'Medium' ? 'bg-primary/20 text-primary' : 
                      'bg-green-500/20 text-green-500'
                    }`}>
                      {inspection.severity}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      inspection.status === 'Resolved' ? 'bg-green-500/20 text-green-500' : 
                      inspection.status === 'Under Review' ? 'bg-primary/20 text-primary' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {inspection.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent inspections found.
              </div>
            )}
          </div>
          {recentInspections.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Link href="/inspections" className="text-sm font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1">
                View All Inspections <Activity className="w-4 h-4" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
