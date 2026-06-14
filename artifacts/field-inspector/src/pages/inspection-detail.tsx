import { useGetInspection, getGetInspectionQueryKey, useUpdateInspection, InspectionUpdateStatus } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Activity, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AssignPanel } from "@/components/assign-panel";
import { CommentsPanel } from "@/components/comments-panel";

const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export default function InspectionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: inspection, isLoading } = useGetInspection(id, { query: { enabled: !!id, queryKey: getGetInspectionQueryKey(id) } });
  const updateMutation = useUpdateInspection();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<string | undefined>();
  const mutateFnRef = useRef(updateMutation.mutate);
  mutateFnRef.current = updateMutation.mutate;

  if (isLoading || !inspection) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-2/3" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const currentStatus = status || inspection.status;

  const handleStatusUpdate = () => {
    if (!status || status === inspection.status) return;
    
    mutateFnRef.current(
      { id, data: { status: status as InspectionUpdateStatus } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetInspectionQueryKey(id), (old: any) => 
            old ? { ...old, status: data.status, updatedAt: data.updatedAt } : old
          );
          toast({ title: "Status Updated", description: "The inspection record has been updated." });
        },
        onError: () => {
          toast({ title: "Update Failed", description: "Could not update status.", variant: "destructive" });
        }
      }
    );
  };

  const icon = inspection.severity === 'Critical' ? createCustomIcon('#ef4444') : 
               inspection.severity === 'Medium' ? createCustomIcon('#f59e0b') : createCustomIcon('#22c55e');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/inspections" className="inline-flex items-center text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Database
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-muted-foreground">#{inspection.id.toString().padStart(4, '0')}</span>
            <Badge variant="outline" className={`uppercase tracking-wider ${
              inspection.severity === 'Critical' ? 'border-destructive text-destructive' : 
              inspection.severity === 'Medium' ? 'border-primary text-primary' : 'border-green-500 text-green-500'
            }`}>
              {inspection.severity} Priority
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{inspection.title}</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-card p-2 rounded-md border border-border shadow-sm">
          <Select value={currentStatus} onValueChange={setStatus}>
            <SelectTrigger className="w-40 bg-background border-input font-bold uppercase tracking-wider text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InspectionUpdateStatus).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleStatusUpdate} disabled={!status || status === inspection.status || updateMutation.isPending} className="h-9 px-3">
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-card-border shadow-md">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{inspection.description}</p>
            </CardContent>
          </Card>

          {inspection.imageData && (
            <Card className="bg-card border-card-border shadow-md overflow-hidden">
              <CardHeader className="bg-secondary/30 border-b border-border py-3">
                <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Photo Evidence
                </CardTitle>
              </CardHeader>
              <div className="relative">
                <img
                  src={inspection.imageData}
                  alt="Inspection site photo"
                  className="w-full max-h-80 object-cover"
                />
              </div>
            </Card>
          )}

          <Card className="bg-card border-card-border shadow-md overflow-hidden">
            <CardHeader className="bg-secondary/30 border-b border-border">
              <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location Context
              </CardTitle>
            </CardHeader>
            <div className="h-[300px] w-full relative">
              <MapContainer 
                center={[inspection.latitude, inspection.longitude]} 
                zoom={15} 
                style={{ height: "100%", width: "100%", background: "#1a1f26" }}
                dragging={false}
                zoomControl={false}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  className="map-tiles"
                />
                <Marker position={[inspection.latitude, inspection.longitude]} icon={icon} />
              </MapContainer>
              <style dangerouslySetInnerHTML={{__html: `
                .map-tiles { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
              `}} />
            </div>
            <CardContent className="p-4 bg-secondary/10 flex justify-between font-mono text-sm">
              <span>LAT: {inspection.latitude.toFixed(6)}</span>
              <span>LNG: {inspection.longitude.toFixed(6)}</span>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-card-border shadow-md">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Issue Type</div>
                <div className="font-mono text-sm bg-secondary px-2 py-1 rounded inline-block">
                  {inspection.issueType}
                </div>
              </div>
              
              <div className="pt-4 border-t border-border flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Created At</div>
                  <div className="font-mono text-sm">{format(new Date(inspection.createdAt), "PPpp")}</div>
                </div>
              </div>

              {inspection.updatedAt && (
                <div className="pt-4 border-t border-border flex items-start gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Last Updated</div>
                    <div className="font-mono text-sm">{format(new Date(inspection.updatedAt), "PPpp")}</div>
                  </div>
                </div>
              )}

              {inspection.reinspectionInterval && (
                <div className="pt-4 border-t border-border flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Re-inspection Schedule</div>
                    <div className="font-mono text-sm capitalize">{inspection.reinspectionInterval}</div>
                    {inspection.nextReinspectionDate && (() => {
                      const due = new Date(inspection.nextReinspectionDate);
                      const isOverdue = due < new Date();
                      return (
                        <div className={`mt-1 text-xs font-mono flex items-center gap-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          {isOverdue ? "Overdue since " : "Due "}{format(due, "MMM d, yyyy")}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border shadow-md">
            <CardHeader>
              <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground">Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <AssignPanel
                inspectionId={inspection.id}
                currentAssignedTo={inspection.assignedTo}
                currentAssignedToName={inspection.assignedToName}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Field Notes — full width below columns */}
      <Card className="bg-card border-card-border shadow-md">
        <CardHeader className="border-b border-border bg-secondary/20">
          <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
            Field Notes &amp; Investigation Log
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <CommentsPanel inspectionId={inspection.id} />
        </CardContent>
      </Card>
    </div>
  );
}
