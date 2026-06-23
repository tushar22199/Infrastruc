import { useState } from "react";
import {
  useListInspections,
  useBulkUpdateStatus,
  getListInspectionsQueryKey,
  type BulkStatusUpdateBodyStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Database,
  Search,
  Filter,
  User,
  UserCheck,
  Inbox,
  CheckSquare,
  X,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

type ViewMode = "all" | "mine" | "queue";

const STATUS_OPTIONS = ["Active", "Under Review", "Resolved"] as const;

export default function Inspections() {
  const { data: inspections, isLoading } = useListInspections({
    query: { queryKey: getListInspectionsQueryKey() },
  });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: bulkUpdate, isPending: isBulkPending } =
    useBulkUpdateStatus();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] =
    useState<BulkStatusUpdateBodyStatus>("Active");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const all = inspections ?? [];
  const myCount = all.filter((i) => user && i.userId === user.id).length;
  const queueCount = all.filter((i) => user && i.assignedTo === user.id).length;

  const filteredInspections = all
    .filter((i) => {
      const matchesSearch =
        i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.issueType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      const matchesView =
        viewMode === "all" ||
        (viewMode === "mine" && user && i.userId === user.id) ||
        (viewMode === "queue" && user && i.assignedTo === user.id);
      return matchesSearch && matchesStatus && matchesView;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const filteredIds = filteredInspections.map((i) => i.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
    setBulkResult(null);
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkResult(null);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkResult(null);
  };

  const applyBulkStatus = async () => {
    if (selectedIds.size === 0) return;
    try {
      const result = await bulkUpdate({
        data: { ids: Array.from(selectedIds), status: bulkStatus },
      });
      await queryClient.invalidateQueries({
        queryKey: getListInspectionsQueryKey(),
      });
      setBulkResult(
        `${result.updatedCount} inspection${result.updatedCount !== 1 ? "s" : ""} updated to "${bulkStatus}".`,
      );
      setSelectedIds(new Set());
    } catch {
      setBulkResult("Update failed — please try again.");
    }
  };

  const emptyMessage =
    viewMode === "mine"
      ? "You have no inspections logged yet. Log your first one."
      : viewMode === "queue"
        ? "No inspections assigned to you. When a project lead assigns you one, it will appear here."
        : "No inspections found matching criteria.";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">
          Audit Database
        </h1>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        {(
          [
            {
              id: "all",
              label: "All Records",
              icon: Database,
              count: all.length,
            },
            { id: "mine", label: "My Logs", icon: User, count: myCount },
            { id: "queue", label: "My Queue", icon: Inbox, count: queueCount },
          ] as {
            id: ViewMode;
            label: string;
            icon: React.ElementType;
            count: number;
          }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setViewMode(tab.id);
                clearSelection();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full ${
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* My Queue banner */}
      {viewMode === "queue" && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
          <Inbox className="h-4 w-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wider">
              Your Assignment Queue
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inspections assigned to you by a project lead. Open any record to
              update its status.
            </p>
          </div>
          {queueCount > 0 && (
            <span className="ml-auto text-xs font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">
              {queueCount} open
            </span>
          )}
        </div>
      )}

      {/* Search / filter bar */}
      <Card className="bg-card border-card-border shadow-md">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center flex-wrap">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                clearSelection();
              }}
              className="pl-9 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                clearSelection();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-xs font-mono text-muted-foreground">
            {filteredInspections.length} record
            {filteredInspections.length !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action toolbar — slides in when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
          <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-bold text-primary uppercase tracking-wider">
            {selectedIds.size} selected
          </span>

          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Set status to
            </span>
            <Select
              value={bulkStatus}
              onValueChange={(v) =>
                setBulkStatus(v as BulkStatusUpdateBodyStatus)
              }
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={isBulkPending}
              onClick={applyBulkStatus}
              className="h-8 text-xs font-bold uppercase tracking-wider"
            >
              {isBulkPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Applying…
                </>
              ) : (
                "Apply"
              )}
            </Button>
          </div>

          <button
            onClick={clearSelection}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* Bulk result toast */}
      {bulkResult && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border ${
            bulkResult.includes("failed")
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}
        >
          {bulkResult}
          <button
            onClick={() => setBulkResult(null)}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Table */}
      <Card className="bg-card border-card-border shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="border-b-border">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allFilteredSelected}
                    data-state={
                      someFilteredSelected && !allFilteredSelected
                        ? "indeterminate"
                        : undefined
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    className="border-muted-foreground/40"
                  />
                </TableHead>
                <TableHead className="w-12 uppercase text-xs tracking-wider font-bold">
                  Photo
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  ID / Title
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Type
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Severity
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Status
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Date
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Logged By
                </TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">
                  Assigned
                </TableHead>
                <TableHead className="text-right uppercase text-xs tracking-wider font-bold">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInspections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-muted-foreground text-sm"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInspections.map((inspection) => {
                  const isOwn = user && inspection.userId === user.id;
                  const isAssignedToMe =
                    user && inspection.assignedTo === user.id;
                  const isSelected = selectedIds.has(inspection.id);
                  return (
                    <TableRow
                      key={inspection.id}
                      className={`border-b-border hover:bg-secondary/50 transition-colors group ${
                        isSelected
                          ? "bg-primary/5 hover:bg-primary/8"
                          : isAssignedToMe
                            ? "bg-primary/5"
                            : ""
                      }`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(inspection.id)}
                          aria-label={`Select inspection ${inspection.id}`}
                          className="border-muted-foreground/40"
                        />
                      </TableCell>
                      <TableCell className="w-12">
                        {inspection.imageData ? (
                          <img
                            src={inspection.imageData}
                            alt="site photo"
                            className="w-10 h-10 rounded object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-border/40 bg-secondary/30 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs text-muted-foreground mb-1">
                          #{inspection.id.toString().padStart(4, "0")}
                        </div>
                        <div className="font-medium">{inspection.title}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {inspection.issueType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase tracking-wider text-[10px] ${
                            inspection.severity === "Critical"
                              ? "border-destructive text-destructive"
                              : inspection.severity === "Medium"
                                ? "border-primary text-primary"
                                : "border-green-500 text-green-500"
                          }`}
                        >
                          {inspection.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="uppercase tracking-wider text-[10px]"
                        >
                          {inspection.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(inspection.createdAt), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell>
                        {inspection.userId ? (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              isOwn
                                ? "bg-primary/15 text-primary"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {isOwn ? "YOU" : inspection.userId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 font-mono">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {inspection.assignedTo ? (
                          <span
                            className={`text-[10px] font-mono flex items-center gap-1 ${
                              isAssignedToMe
                                ? "text-primary font-bold"
                                : "text-muted-foreground"
                            }`}
                          >
                            <UserCheck className="h-3 w-3" />
                            {isAssignedToMe
                              ? "YOU"
                              : (inspection.assignedToName ??
                                inspection.assignedTo.slice(0, 8))}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/inspections/${inspection.id}`}
                          className="text-primary text-sm font-bold uppercase tracking-wider hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
