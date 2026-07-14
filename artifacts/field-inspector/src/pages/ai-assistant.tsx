import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";
import { Bot } from "lucide-react";
import {
  FileText,
  BarChart3,
  Search,
  Image,
  MapPinned,
  AlertTriangle,
} from "lucide-react";

export default function AIAssistant() {
  const quickActions = [
    {
      title: "Dashboard Summary",
      description: "Summarize inspection statistics and trends.",
      icon: BarChart3,
    },
    {
      title: "Find Critical Issues",
      description: "Locate high-priority inspections instantly.",
      icon: AlertTriangle,
    },
    {
      title: "Generate Report",
      description: "Create professional inspection reports.",
      icon: FileText,
    },
    {
      title: "Engineering Standards",
      description: "Search codes and compliance requirements.",
      icon: Search,
    },
    {
      title: "Analyze Inspection Image",
      description: "AI-powered defect detection from photos.",
      icon: Image,
    },
    {
      title: "Infrastructure Hotspots",
      description: "Find locations needing immediate attention.",
      icon: MapPinned,
    },
  ];
  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-7 w-7 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold">
              Infrastructure Copilot
            </h1>

            <p className="mt-1 text-muted-foreground">
              AI-powered engineering assistant for inspections,
              reports, analytics and infrastructure intelligence.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Quick Actions
        </h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              className="rounded-xl border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-md"
            >
              <action.icon className="mb-4 h-6 w-6 text-primary" />

              <h3 className="font-semibold">
                {action.title}
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                {action.description}
              </p>
            </button>
          ))}
        </div>
        <Card className="mt-8 border shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-6">
              Conversation
            </h2>

            <div className="space-y-6">

              {/* AI Message */}
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>

                <div className="rounded-xl bg-muted p-4 max-w-3xl">
                  <p className="font-semibold mb-2">
                    Infrastructure Copilot
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Hello! I'm your AI engineering assistant.
                  </p>

                  <p className="text-sm text-muted-foreground mt-3">
                    I can help you:
                  </p>

                  <ul className="mt-2 ml-5 list-disc text-sm text-muted-foreground">
                    <li>Summarize inspections</li>
                    <li>Find critical infrastructure issues</li>
                    <li>Generate reports</li>
                    <li>Answer engineering questions</li>
                    <li>Analyze inspection images</li>
                  </ul>
                </div>
              </div>

              {/* Chat Input */}
              <div className="flex gap-3">
                <Input
                  placeholder="Ask Infrastructure Copilot anything..."
                  className="h-11"
                />

                <Button className="h-11 px-5">
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}