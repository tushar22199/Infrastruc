import { GoogleOAuthProvider } from "@react-oauth/google";
import LoginPage from "@/pages/login";
import { AuthProvider } from "@/lib/auth";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pages
import Dashboard from "@/pages/dashboard";
import MapView from "@/pages/map-view";
import LogInspection from "@/pages/log-inspection";
import Inspections from "@/pages/inspections";
import InspectionDetail from "@/pages/inspection-detail";
import ActivityPage from "@/pages/activity";
import { setBaseUrl } from "@workspace/api-client-react";

setBaseUrl("https://infrastruc.onrender.com");

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
        <Route path="/activity" component={ActivityPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function LoginGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  const bypassAuth =
    import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
  console.log(import.meta.env.VITE_BYPASS_AUTH);

  if (loading && !bypassAuth) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sm font-mono uppercase tracking-widest">
            Authenticating...
          </p>
        </div>
      </div>
    );
  }

  if (bypassAuth) {
    return <>{children}</>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <GoogleOAuthProvider clientId="368629552310-hj6paovh03h7dko2s66omr35qgvkoh84.apps.googleusercontent.com">
      <AuthProvider>
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
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
