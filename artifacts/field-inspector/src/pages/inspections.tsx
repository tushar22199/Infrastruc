import { useState } from "react";
import { useListInspections } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Search, Filter } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Inspections() {
  const { data: inspections, isLoading } = useListInspections();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const filteredInspections = inspections?.filter(i => {
    const matchesSearch = i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          i.issueType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">Audit Database</h1>
      </div>

      <Card className="bg-card border-card-border shadow-md">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search records..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
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
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="border-b-border">
                <TableHead className="uppercase text-xs tracking-wider font-bold">ID / Title</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">Type</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">Severity</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">Status</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-bold">Date</TableHead>
                <TableHead className="text-right uppercase text-xs tracking-wider font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No inspections found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInspections.map((inspection) => (
                  <TableRow key={inspection.id} className="border-b-border hover:bg-secondary/50 transition-colors group">
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground mb-1">#{inspection.id.toString().padStart(4, '0')}</div>
                      <div className="font-medium">{inspection.title}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{inspection.issueType}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`uppercase tracking-wider text-[10px] ${
                        inspection.severity === 'Critical' ? 'border-destructive text-destructive' : 
                        inspection.severity === 'Medium' ? 'border-primary text-primary' : 'border-green-500 text-green-500'
                      }`}>
                        {inspection.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">
                        {inspection.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {format(new Date(inspection.createdAt), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/inspections/${inspection.id}`} className="text-primary text-sm font-bold uppercase tracking-wider hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
