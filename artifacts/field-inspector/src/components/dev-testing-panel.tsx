import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOfflineSync } from "@/lib/offline-sync";
import { useForcedStatus, setForcedStatus } from "@/lib/network-status";
import {
  InspectionInputIssueType,
  InspectionInputSeverity,
  type InspectionInput,
  type InspectionGeometry,
} from "@workspace/api-client-react";
import { FlaskConical, Wifi, WifiOff, DatabaseZap, Loader2 } from "lucide-react";

const ISSUE_TYPES = Object.values(InspectionInputIssueType);
const MOCK_SEVERITIES = [InspectionInputSeverity.Critical, InspectionInputSeverity.Medium];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function DevTestingPanel() {
  const { addToQueue, syncQueue, queueCount, isOnline, isSyncing } = useOfflineSync();
  const forced = useForcedStatus();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleToggleOffline = (simulateOffline: boolean) => {
    setForcedStatus(simulateOffline ? "offline" : "online");
    toast({
      title: simulateOffline ? "Simulating Offline" : "Back Online",
      description: simulateOffline
        ? "Network forced OFFLINE — new logs will queue locally."
        : "Network forced ONLINE — draining the offline queue.",
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      for (let i = 0; i < 5; i++) {
        const severity = randomFrom(MOCK_SEVERITIES);
        const issueType = randomFrom(ISSUE_TYPES);
        const lng = Number((-124 + Math.random() * 58).toFixed(6));
        const lat = Number((24 + Math.random() * 25).toFixed(6));
        const payload: InspectionInput = {
          title: `[MOCK] ${severity} ${issueType}`,
          issueType,
          severity,
          description: `Auto-generated stress-test log #${i + 1}. Dummy geometry for IndexedDB queue testing.`,
          geometry: { type: "Point", coordinates: [lng, lat] } as InspectionGeometry,
          status: "Active",
        };
        await addToQueue(payload);
      }
      toast({
        title: "5 Mock Logs Queued",
        description: isOnline
          ? "Online — the sync engine is draining them now."
          : "Offline — watch the counter, then toggle back online to drain.",
      });
      void syncQueue();
    } catch (e) {
      console.error("Failed to generate mock logs", e);
      toast({
        title: "Generation Failed",
        description: "Could not write mock logs to IndexedDB.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-500">
          <FlaskConical className="h-4 w-4" />
          Developer Testing Panel
          <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
            DEV ONLY
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network override toggle */}
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <div className="leading-tight">
              <div className="text-sm font-medium">Simulate Offline</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                Status: {isOnline ? "ONLINE" : "OFFLINE"}
                {forced ? " (forced)" : ""}
              </div>
            </div>
          </div>
          <Switch checked={forced === "offline"} onCheckedChange={handleToggleOffline} />
        </div>

        {/* Mock log generator */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="outline"
            className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 font-bold uppercase tracking-wider"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DatabaseZap className="mr-2 h-4 w-4" />
            )}
            Generate 5 Mock Logs
          </Button>
          <div className="text-xs text-muted-foreground">
            Queue:{" "}
            <span className="font-mono font-bold text-foreground">{queueCount}</span> item
            {queueCount === 1 ? "" : "s"}
            {isSyncing && <span className="ml-2 text-amber-500 animate-pulse">syncing…</span>}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Toggle <strong>Simulate Offline</strong>, generate mock Critical/Medium logs to fill the
          IndexedDB queue, then toggle back online to watch the sync counter drain.
        </p>
      </CardContent>
    </Card>
  );
}
