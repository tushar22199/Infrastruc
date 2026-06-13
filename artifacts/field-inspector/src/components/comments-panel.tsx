import { useState, useRef, useEffect } from "react";
import {
  useListComments,
  useAddComment,
  getListCommentsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface CommentsPanelProps {
  inspectionId: number;
}

export function CommentsPanel({ inspectionId }: CommentsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const { data: comments = [], isLoading } = useListComments(inspectionId, {
    query: { queryKey: getListCommentsQueryKey(inspectionId), refetchInterval: 20_000 },
  });

  const addComment = useAddComment({
    mutation: {
      onSuccess: (newComment) => {
        qc.setQueryData(
          getListCommentsQueryKey(inspectionId),
          (old: typeof comments) => [...(old ?? []), newComment]
        );
        setDraft("");
      },
      onError: () => {
        toast({ title: "Failed to post note", variant: "destructive" });
      },
    },
  });

  // Scroll to bottom whenever comments change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || addComment.isPending) return;
    addComment.mutate({ id: inspectionId, data: { body: draft.trim() } });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const myId = user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Field Notes
        </span>
        {comments.length > 0 && (
          <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full ml-auto">
            {comments.length}
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-72 pr-1">
        {isLoading && (
          <div className="text-xs text-muted-foreground font-mono animate-pulse px-1">
            Loading notes...
          </div>
        )}
        {!isLoading && comments.length === 0 && (
          <div className="text-center py-6 space-y-1">
            <MessageSquare className="h-6 w-6 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground/60 font-mono">No field notes yet.</p>
            <p className="text-[10px] text-muted-foreground/40">
              Add observations, measurements, or next steps below.
            </p>
          </div>
        )}
        {comments.map((c) => {
          const isMe = myId && c.userId === myId;
          const ts = new Date(c.createdAt);
          return (
            <div
              key={c.id}
              className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold uppercase mt-0.5 ${
                  isMe
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {(c.userDisplayName ?? "?")[0]}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  isMe
                    ? "bg-primary/10 text-foreground rounded-tr-none"
                    : "bg-secondary/60 text-foreground rounded-tl-none"
                }`}
              >
                <div
                  className={`text-[10px] font-bold mb-1 ${
                    isMe ? "text-primary text-right" : "text-muted-foreground"
                  }`}
                >
                  {isMe ? "You" : (c.userDisplayName ?? "Engineer")}
                </div>
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
                <div
                  className={`text-[9px] font-mono text-muted-foreground/50 mt-1.5 ${
                    isMe ? "text-right" : ""
                  }`}
                  title={format(ts, "PPpp")}
                >
                  {formatDistanceToNow(ts, { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <Textarea
          placeholder="Add a field note... (Ctrl+Enter to submit)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="resize-none text-sm bg-secondary/30 border-secondary focus-visible:ring-primary/40 font-mono"
          disabled={addComment.isPending}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {draft.length > 0 ? `${draft.length} chars` : "Ctrl+Enter to submit"}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!draft.trim() || addComment.isPending}
            className="h-8 gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            {addComment.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post Note
          </Button>
        </div>
      </form>
    </div>
  );
}
