import { useGetDashboardSummary, useGetByType, useGetBySeverity, useListInspections, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, Activity, LayoutDashboard } from "lucide-react";
import { exportAuditReport } from "@/lib/pdf-export";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: typeBreakdown, isLoading: isLoadingTypes } = useGetByType();
  const { data: severityBreakdown, isLoading: isLoadingSeverities } = useGetBySeverity();
  const { data: inspections, isLoading: isLoadingInspections } = useListInspections(); // Fallback for recent inspections

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
