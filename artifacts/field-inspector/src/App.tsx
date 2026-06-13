import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { useAuth } from "@workspace/replit-auth-web";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pages
import Dashboard from "@/pages/dashboard";
import MapView from "@/pages/map-view";
import LogInspection from "@/pages/log-inspection";
import Inspections from "@/pages/inspections";
import InspectionDetail from "@/pages/inspection-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/map" component={MapView} />
        <Route path="/log" component={LogInspection} />
        <Route path="/inspections" component={Inspections} />
        <Route path="/inspections/:id" component={InspectionDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function LoginGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sm font-mono uppercase tracking-widest">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 max-w-sm text-center px-6">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <span className="font-bold tracking-tight text-2xl uppercase text-foreground">AUDITOR</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">Field Inspection System</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Secure access required. Sign in to log, track, and analyze infrastructure failures.
            </p>
          </div>
          <div className="w-full border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Offline-First", desc: "Field-ready" },
                { label: "GPS Capture", desc: "Map-integrated" },
                { label: "PDF Reports", desc: "Audit-ready" },
              ].map((f) => (
                <div key={f.label} className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">{f.label}</div>
                  <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                </div>
              ))}
            </div>
            <Button onClick={login} className="w-full font-bold uppercase tracking-wider h-11">
              Sign In to Continue
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            INTELLIGENT FIELD INSPECTION &amp; INFRASTRUCTURE AUDITOR
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <LoginGate>
            <Router />
          </LoginGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
