import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([
    {
      role: "assistant",
      content:
        "Welcome to Infrastructure Copilot.\n\nI can help you analyze inspections, summarize dashboard data, generate reports, answer engineering questions, and assist with infrastructure management.\n\nHow can I help you today?",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = async (message?: string) => {
    const userMessage = message ?? input;

    if (!userMessage.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    if (!message) {
      setInput("");
    }
    try {
      setIsLoading(true);
      const res = await fetch(
        "https://infrastruc.onrender.com/api/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              ...messages,
              {
                role: "user",
                content: userMessage,
              },
            ],
          }),
        }
      );

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong while contacting the AI.",
        },
      ]);
    }
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isLoading]);
 
  
  const suggestedPrompts = [
    "Summarize today's inspections",
    "Show all critical inspections",
    "Generate a maintenance report",
    "Which inspections require immediate attention?",
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

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Suggested Questions
          </h2>

          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                onClick={() => sendMessage(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
        
        <Card className="mt-8 border shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-6">
              Conversation
            </h2>

            <div className="space-y-6">

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                  
                >
                  {message.role === "assistant" && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}

                  <div
                    className={`rounded-xl p-4 max-w-3xl ${
                      message.role === "assistant"
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary animate-pulse" />
                  </div>

                  <div className="rounded-xl bg-muted p-4">
                    <p className="font-semibold">
                      Infrastructure Copilot
                    </p>

                    <p className="text-sm text-muted-foreground animate-pulse">
                      Thinking...
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
              
             

              {/* Chat Input */}
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask Infrastructure Copilot anything..."
                  className="h-11"
                />

                <Button
                  className="h-11 px-5"
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                >
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