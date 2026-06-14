import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { InspectionInputIssueType, InspectionInputSeverity } from "@workspace/api-client-react";
import { useOfflineSync } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";
import { compressImageToBase64 } from "@/lib/image-compress";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusSquare, Save, Navigation, RefreshCw, Camera, X, ImageIcon, Loader2, MapPin } from "lucide-react";
import { GeometryDrawer, type GeomType, type Vertex } from "@/components/geometry-drawer";

const REINSPECTION_INTERVALS = [
  { value: "none", label: "None — single inspection only" },
  { value: "weekly", label: "Weekly — re-inspect every 7 days" },
  { value: "monthly", label: "Monthly — re-inspect every 30 days" },
  { value: "quarterly", label: "Quarterly — re-inspect every 90 days" },
] as const;

const geometrySchema = z.object({
  type: z.enum(["Point", "LineString", "Polygon"] as const),
  coordinates: z.unknown(),
}).refine((g) => {
  const c = g.coordinates;
  if (g.type === "Point") {
    return Array.isArray(c) && (c as unknown[]).length === 2 && typeof (c as unknown[])[0] === "number";
  }
  if (g.type === "LineString") {
    return Array.isArray(c) && (c as unknown[]).length >= 2;
  }
  if (g.type === "Polygon") {
    if (!Array.isArray(c) || !Array.isArray((c as unknown[])[0])) return false;
    return ((c as unknown[][])[0]).length >= 3;
  }
  return false;
}, "Complete the drawing on the map before submitting");

const formSchema = z.object({
  title: z.string().min(3, "Title is required"),
  issueType: z.nativeEnum(InspectionInputIssueType),
  severity: z.nativeEnum(InspectionInputSeverity),
  description: z.string().min(10, "Provide a detailed description"),
  geometry: geometrySchema,
  reinspectionInterval: z.enum(["none", "weekly", "monthly", "quarterly"] as const).default("none"),
});

export default function LogInspection() {
  const [locationStr, setLocationStr] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialLat = searchParams.get("lat");
  const initialLng = searchParams.get("lng");

  const { addToQueue, syncQueue, isOnline } = useOfflineSync();
  const { toast } = useToast();
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Geometry drawing state — lifted here so GPS can set vertices directly
  const [geometryType, setGeometryType] = useState<GeomType>("Point");
  const [vertices, setVertices] = useState<Vertex[]>(() => {
    if (initialLat && initialLng) return [[parseFloat(initialLng), parseFloat(initialLat)]];
    return [];
  });

  const initialGeometry: { type: "Point" | "LineString" | "Polygon"; coordinates: unknown } =
    initialLat && initialLng
      ? { type: "Point", coordinates: [parseFloat(initialLng), parseFloat(initialLat)] }
      : { type: "Point", coordinates: [] };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      issueType: InspectionInputIssueType.Pavement_Distress,
      severity: InspectionInputSeverity.Low,
      description: "",
      geometry: initialGeometry,
      reinspectionInterval: "none",
    },
  });

  // Sync drawing vertices → form geometry whenever vertices or type changes
  useEffect(() => {
    if (vertices.length === 0) return;
    let geom: { type: "Point" | "LineString" | "Polygon"; coordinates: unknown } | null = null;
    if (geometryType === "Point") {
      geom = { type: "Point", coordinates: vertices[0] };
    } else if (geometryType === "LineString" && vertices.length >= 2) {
      geom = { type: "LineString", coordinates: vertices };
    } else if (geometryType === "Polygon" && vertices.length >= 3) {
      geom = { type: "Polygon", coordinates: [vertices] };
    }
    if (geom) form.setValue("geometry", geom, { shouldValidate: false });
  }, [vertices, geometryType, form]);

  const getLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          setGeometryType("Point");
          setVertices([[lng, lat]]);
          form.setValue("geometry", { type: "Point", coordinates: [lng, lat] }, { shouldValidate: false });
          setIsLocating(false);
          toast({ title: "Location captured", description: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}` });
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImageToBase64(file);
      setImageData(compressed);
      setImagePreview(compressed);
      const kb = Math.round((compressed.length * 3) / 4 / 1024);
      toast({ title: "Photo attached", description: `Compressed to ~${kb} KB and ready to submit.` });
    } catch {
      toast({ title: "Compression failed", description: "Could not process image.", variant: "destructive" });
    } finally {
      setIsCompressing(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setImageData(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { reinspectionInterval, geometry, ...rest } = values;
    const payload: any = {
      ...rest,
      geometry,
      status: "Active" as const,
      ...(reinspectionInterval !== "none" ? { reinspectionInterval } : {}),
      ...(imageData ? { imageData } : {}),
    };

    setIsSubmitting(true);
    try {
      // Offline-first: persist to IndexedDB before firing the sync engine.
      await addToQueue(payload);
    } catch (e) {
      console.error("Failed to save inspection locally", e);
      toast({
        title: "Save Failed",
        description: "Couldn't save the inspection to local storage. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (isOnline) {
      toast({ title: "Inspection Saved", description: "Saved locally — syncing to the server now." });
      // Fire-and-forget background sync; the engine drains the queue and clears synced records.
      void syncQueue();
    } else {
      toast({ title: "Saved Offline", description: "Inspection saved to local queue. Will sync when online." });
    }

    setLocationStr("/inspections");
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

              {/* Photo Capture */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Photo Evidence</span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">(optional · max 200 KB)</span>
                  </div>
                  {!imagePreview && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isCompressing}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.removeAttribute("capture");
                            fileInputRef.current.click();
                          }
                        }}
                        className="text-xs uppercase tracking-wider h-8"
                      >
                        <ImageIcon className="mr-1.5 h-3 w-3" />
                        Gallery
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isCompressing}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.setAttribute("capture", "environment");
                            fileInputRef.current.click();
                          }
                        }}
                        className="text-xs uppercase tracking-wider h-8"
                      >
                        <Camera className="mr-1.5 h-3 w-3" />
                        Camera
                      </Button>
                    </div>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {isCompressing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/40 rounded-md p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compressing image…
                  </div>
                )}

                {imagePreview && (
                  <div className="relative rounded-md overflow-hidden border border-border">
                    <img
                      src={imagePreview}
                      alt="Inspection photo preview"
                      className="w-full max-h-64 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] font-mono px-2 py-1">
                      Photo attached · ~{Math.round((imagePreview.length * 3) / 4 / 1024)} KB
                    </div>
                  </div>
                )}
              </div>

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
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Asset Geometry</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={geometryType}
                      onValueChange={(val) => {
                        const t = val as GeomType;
                        setGeometryType(t);
                        setVertices([]);
                        form.setValue("geometry", { type: t, coordinates: [] }, { shouldValidate: false });
                      }}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Point">Point</SelectItem>
                        <SelectItem value="LineString">Line</SelectItem>
                        <SelectItem value="Polygon">Area</SelectItem>
                      </SelectContent>
                    </Select>
                    {geometryType === "Point" && (
                      <Button type="button" variant="outline" size="sm" onClick={getLocation} disabled={isLocating} className="text-xs uppercase tracking-wider h-8">
                        <Navigation className="mr-1.5 h-3 w-3" />
                        {isLocating ? "Locating…" : "GPS"}
                      </Button>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="geometry"
                  render={() => (
                    <FormItem>
                      <GeometryDrawer
                        geometryType={geometryType}
                        vertices={vertices}
                        onAddVertex={(lng, lat) => {
                          if (geometryType === "Point") {
                            setVertices([[lng, lat]]);
                          } else {
                            setVertices((prev) => [...prev, [lng, lat]]);
                          }
                        }}
                        onUndo={() => setVertices((prev) => prev.slice(0, -1))}
                        onClear={() => {
                          setVertices([]);
                          form.setValue("geometry", { type: geometryType, coordinates: [] }, { shouldValidate: false });
                        }}
                        initialCenter={
                          initialLat && initialLng
                            ? [parseFloat(initialLat), parseFloat(initialLng)]
                            : undefined
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSubmitting || isCompressing} className="w-full font-bold uppercase tracking-wider h-12">
                <Save className="mr-2 h-5 w-5" />
                {isSubmitting ? "Saving..." : "Submit Log"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
