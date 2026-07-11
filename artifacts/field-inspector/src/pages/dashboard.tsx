import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  useGetDashboardSummary,
  useGetByType,
  useGetBySeverity,
  useListInspections,
  useGetHotspots,
  useGetOverdueReinspections,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Download,
  AlertTriangle,
  CheckCircle,
  Activity,
  LayoutDashboard,
  Flame,
  MapPin,
  RefreshCw,
  Clock,
  ClipboardList,
  TrendingUp,
  ShieldAlert,
  Cloud,
} from "lucide-react";
import { exportAuditReport } from "@/lib/pdf-export";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e"];
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    { query: { queryKey: getGetDashboardSummaryQueryKey() } },
  );

  const { data: typeBreakdown, isLoading: isLoadingTypes } = useGetByType();
  const { data: severityBreakdown, isLoading: isLoadingSeverities } =
    useGetBySeverity();
  const { data: inspections, isLoading: isLoadingInspections } =
    useListInspections();
  const { data: hotspots } = useGetHotspots();
  const { data: overdueItems } = useGetOverdueReinspections();
  const [aiInsight, setAiInsight] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const generateInsights = async () => {
    try {
      setLoadingAI(true);

      const response = await fetch(
        "https://infrastruc.onrender.com/api/ai/insights",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            totalInspections: summary?.totalLogs ?? 0,
            activeIssues: summary?.activeIssues ?? 0,
            regionalHealth: summary?.regionalHealthScore ?? 0,
            overdueInspections: overdueItems?.length ?? 0,
            severityBreakdown: severityData,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
          setAiInsight(data.insight);
      }
      console.log(data);

    if (data.success) {
        setAiInsight(data.insight);
      } else {
        setAiInsight("Failed to generate AI insights.");
      }
    } catch (error) {
      console.error(error);
      setAiInsight("Error generating AI insights.");
    } finally {
      setLoadingAI(false);
    }
  };
  const handleExport = () => {
    if (summary && inspections) {
      exportAuditReport(summary, inspections);
    }
  };

  if (
    isLoadingSummary ||
    isLoadingTypes ||
    isLoadingSeverities ||
    isLoadingInspections
  ) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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

  const recentInspections = inspections
    ? [...inspections]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5)
    : [];

  const inspectionTrendData = [
    { month: "Jan", inspections: 12 },
    { month: "Feb", inspections: 19 },
    { month: "Mar", inspections: 15 },
    { month: "Apr", inspections: 27 },
    { month: "May", inspections: 23 },
    { month: "Jun", inspections: summary?.totalLogs || 0 },
  ];

  const severityData = [
    {
      name: "Critical",
      value:
        severityBreakdown?.find((s) => s.severity === "Critical")?.count || 0,
    },
    {
      name: "High",
      value: severityBreakdown?.find((s) => s.severity === "High")?.count || 0,
    },
    {
      name: "Medium",
      value:
        severityBreakdown?.find((s) => s.severity === "Medium")?.count || 0,
    },
    {
      name: "Low",
      value: severityBreakdown?.find((s) => s.severity === "Low")?.count || 0,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>

            <div>
              <h1 className="text-4xl font-black tracking-tight">
                Infrastructure Intelligence
              </h1>

              <p className="mt-1 text-sm uppercase tracking-[0.2em] text-primary">
                Operations Dashboard
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Monitor infrastructure health, AI insights, field inspections and
            operational performance across all active regions.
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={!summary || !inspections}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wider"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Audit Report
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Inspection Trend */}
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle>Inspection Trend</CardTitle>
            <CardDescription>Monthly inspection activity</CardDescription>
          </CardHeader>

          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inspectionTrendData}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="inspections"
                  stroke="hsl(var(--primary))"
                  strokeWidth={4}
                  dot={{ r: 5 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Severity Breakdown */}
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle>Severity Breakdown</CardTitle>
            <CardDescription>Current issue distribution</CardDescription>
          </CardHeader>

          <CardContent className="h-80">
            <div className="relative h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    cx="43%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={130}
                    paddingAngle={4}
                    label={false}
                    labelLine={false}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>

                  <Tooltip
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid #374151",
                      borderRadius: 12,
                    }}
                  />

                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{
                      right: -5,
                      lineHeight: "28px",
                    }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="-translate-x-16 flex flex-col items-center">
                  <div className="text-5xl font-bold text-foreground">
                    {summary?.activeIssues ?? 0}
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    Active Issues
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Infrastructure Insights
            </CardTitle>
            <CardDescription>AI-generated operational summary</CardDescription>
          </div>

          <Button
            size="sm"
            onClick={generateInsights}
            disabled={loadingAI}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loadingAI ? "animate-spin" : ""}`}
            />

            {loadingAI ? "Generating..." : "Generate"}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            {aiInsight ? (
              <div className="whitespace-pre-wrap text-sm leading-7">
                {aiInsight}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Click <strong>Generate</strong> to get AI-powered infrastructure
                insights.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hotspot Alerts */}
      {hotspots && hotspots.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-destructive text-sm">
              {hotspots.length} Critical Hotspot{hotspots.length > 1 ? "s" : ""}{" "}
              Detected
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Clusters of active Critical inspections within{" "}
              {hotspots[0]?.radiusKm ?? 10} km
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {hotspots.map((h) => (
              <Link
                key={h.id}
                href={`/map?hotspot=${h.id}&lat=${h.centerLat}&lng=${h.centerLng}`}
              >
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-card p-3 hover:border-destructive/60 transition-colors cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                    <span className="text-destructive font-bold font-mono text-sm">
                      {h.count}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mb-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {h.centerLat.toFixed(4)}, {h.centerLng.toFixed(4)}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {h.titles.slice(0, 2).map((title, i) => (
                        <li
                          key={i}
                          className="text-xs text-foreground truncate"
                        >
                          {title}
                        </li>
                      ))}
                      {h.titles.length > 2 && (
                        <li className="text-xs text-muted-foreground">
                          +{h.titles.length - 2} more
                        </li>
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
              {overdueItems.length} Overdue Re-inspection
              {overdueItems.length > 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Scheduled re-inspections past their due date
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {overdueItems.map((item) => (
              <Link key={item.id} href={`/inspections/${item.id}`}>
                <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-card p-3 hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {item.title}
                    </div>
                    <div className="text-[10px] font-mono text-amber-500 mt-0.5 capitalize">
                      {item.reinspectionInterval} · {item.daysOverdue}d overdue
                    </div>
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                        item.severity === "Critical"
                          ? "text-destructive"
                          : item.severity === "Medium"
                            ? "text-primary"
                            : "text-green-500"
                      }`}
                    >
                      {item.severity}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="group rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>

              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>

            <div className="mt-4 text-4xl font-black font-mono">
              {summary?.totalLogs ?? 0}
            </div>

            <p className="mt-2 text-base font-semibold">Total Inspections</p>

            <p className="text-sm text-green-500">+12% from last month</p>
          </CardContent>
        </Card>
        <Card className="group rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>

              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>

            <div className="mt-6 text-5xl font-black font-mono text-red-500">
              {summary?.activeIssues ?? 0}
            </div>

            <p className="mt-2 font-semibold">Active Issues</p>

            <p className="text-sm text-red-500">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="group rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>

              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>

            <div className="mt-6 text-5xl font-black font-mono text-green-500">
              {summary?.regionalHealthScore ?? 0}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>

            <p className="mt-2 font-semibold">Regional Health</p>

            <p className="text-sm text-green-500">Infrastructure Status</p>
          </CardContent>
        </Card>
        <Card className="group rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Cloud className="h-6 w-6 text-blue-500" />
              </div>

              <RefreshCw className="h-5 w-5 text-blue-500" />
            </div>

            <div className="mt-6 text-5xl font-black font-mono text-blue-500">
              {overdueItems?.length ?? 0}
            </div>

            <p className="mt-2 font-semibold">Overdue Re-inspections</p>

            <p className="text-sm text-blue-500">Requires scheduling</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider">
              Issues by Severity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {severityBreakdown?.map((item) => {
              const max = Math.max(
                ...(severityBreakdown.map((s) => s.count) || [1]),
              );
              const percent = (item.count / max) * 100;
              const colorClass =
                item.severity === "Critical"
                  ? "bg-destructive"
                  : item.severity === "Medium"
                    ? "bg-primary"
                    : "bg-green-500";

              return (
                <div key={item.severity} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium uppercase text-muted-foreground tracking-wider">
                      {item.severity}
                    </span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!severityBreakdown || severityBreakdown.length === 0) && (
              <div className="text-muted-foreground text-sm text-center py-4">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider">
              Issues by Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeBreakdown?.map((item) => {
              const max = Math.max(
                ...(typeBreakdown.map((s) => s.count) || [1]),
              );
              const percent = (item.count / max) * 100;

              return (
                <div key={item.issueType} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground uppercase tracking-wider text-xs truncate max-w-[200px]">
                      {item.issueType}
                    </span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!typeBreakdown || typeBreakdown.length === 0) && (
              <div className="text-muted-foreground text-sm text-center py-4">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border shadow-md">
        <CardHeader>
          <CardTitle className="uppercase tracking-wider">
            Recent Inspections
          </CardTitle>
          <CardDescription>
            Latest infrastructure reports from the field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentInspections.length > 0 ? (
              recentInspections.map((inspection) => (
                <div
                  key={inspection.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-secondary/50 border border-secondary-border hover:bg-secondary transition-colors"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/inspections/${inspection.id}`}
                      className="font-semibold text-lg hover:text-primary transition-colors"
                    >
                      {inspection.title}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span>{inspection.issueType}</span>
                      <span>•</span>
                      <span>
                        {format(
                          new Date(inspection.createdAt),
                          "MMM d, yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        inspection.severity === "Critical"
                          ? "bg-destructive/20 text-destructive"
                          : inspection.severity === "Medium"
                            ? "bg-primary/20 text-primary"
                            : "bg-green-500/20 text-green-500"
                      }`}
                    >
                      {inspection.severity}
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        inspection.status === "Resolved"
                          ? "bg-green-500/20 text-green-500"
                          : inspection.status === "Under Review"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
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
              <Link
                href="/inspections"
                className="text-sm font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
              >
                View All Inspections <Activity className="w-4 h-4" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
