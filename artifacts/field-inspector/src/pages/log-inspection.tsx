import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateInspection, useListInspections, getListInspectionsQueryKey, InspectionInputIssueType, InspectionInputSeverity } from "@workspace/api-client-react";
import { useOfflineSync } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusSquare, Save, Navigation, RefreshCw } from "lucide-react";

const REINSPECTION_INTERVALS = [
  { value: "none", label: "None — single inspection only" },
  { value: "weekly", label: "Weekly — re-inspect every 7 days" },
  { value: "monthly", label: "Monthly — re-inspect every 30 days" },
  { value: "quarterly", label: "Quarterly — re-inspect every 90 days" },
] as const;

const formSchema = z.object({
  title: z.string().min(3, "Title is required"),
  issueType: z.nativeEnum(InspectionInputIssueType),
  severity: z.nativeEnum(InspectionInputSeverity),
  description: z.string().min(10, "Provide a detailed description"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  reinspectionInterval: z.enum(["none", "weekly", "monthly", "quarterly"]).default("none"),
});

export default function LogInspection() {
  const [locationStr, setLocationStr] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialLat = searchParams.get("lat");
  const initialLng = searchParams.get("lng");

  const { addToQueue, isOnline } = useOfflineSync();
  const createMutation = useCreateInspection();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLocating, setIsLocating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      issueType: InspectionInputIssueType.Pavement_Distress,
      severity: InspectionInputSeverity.Low,
      description: "",
      latitude: initialLat ? parseFloat(initialLat) : 0,
      longitude: initialLng ? parseFloat(initialLng) : 0,
      reinspectionInterval: "none",
    },
  });

  const getLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("latitude", position.coords.latitude);
          form.setValue("longitude", position.coords.longitude);
          setIsLocating(false);
          toast({ title: "Location captured", description: "GPS coordinates updated." });
        },
        (error) => {
          setIsLocating(false);
          toast({ title: "Location error", description: error.message, variant: "destructive" });
        }
      );
    } else {
      setIsLocating(false);
      toast({ title: "Not supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const { reinspectionInterval, ...rest } = values;
    const payload = {
      ...rest,
      status: "Active" as const,
      ...(reinspectionInterval !== "none" ? { reinspectionInterval } : {}),
    };

    // Always queue first for offline-first architecture
    addToQueue(payload);

    if (isOnline) {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            // Remove from queue logic is handled by the sync process in a real robust offline system,
            // but for simplicity here we assume syncQueue will pick it up or we just let it sync automatically.
            // A more robust implementation would remove specifically this item.
            queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
            toast({
              title: "Inspection Logged",
              description: "Successfully submitted to server.",
            });
            setLocationStr("/inspections");
          },
          onError: () => {
            toast({
              title: "Queued for Sync",
              description: "Server error. Inspection saved locally and will sync when available.",
            });
            setLocationStr("/");
          }
        }
      );
    } else {
      toast({
        title: "Saved Offline",
        description: "Inspection saved to local queue. Will sync when online.",
      });
      setLocationStr("/");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <PlusSquare className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">Log Inspection</h1>
      </div>

      <Card className="border-card-border shadow-lg">
        <CardHeader>
          <CardTitle className="uppercase tracking-wider">New Incident Report</CardTitle>
          <CardDescription>Record infrastructure failure details. Data is saved locally if offline.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Severe pothole on Main St" {...field} className="font-medium" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="issueType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Issue Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(InspectionInputIssueType).map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Severity</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(InspectionInputSeverity).map((sev) => (
                            <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Provide detailed notes on the infrastructure failure..." className="min-h-[120px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reinspectionInterval"
                render={({ field }) => (
                  <FormItem className="pt-2 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Re-inspection Schedule</FormLabel>
                    </div>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REINSPECTION_INTERVALS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      When set, a re-inspection due date will be scheduled and flagged on the dashboard when overdue.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Location Data</h3>
                  <Button type="button" variant="outline" size="sm" onClick={getLocation} disabled={isLocating} className="text-xs uppercase tracking-wider h-8">
                    <Navigation className="mr-2 h-3 w-3" />
                    {isLocating ? "Locating..." : "Get Current GPS"}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Latitude</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-wider text-muted-foreground">Longitude</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" disabled={createMutation.isPending} className="w-full font-bold uppercase tracking-wider h-12">
                <Save className="mr-2 h-5 w-5" />
                {createMutation.isPending ? "Submitting..." : "Submit Log"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
