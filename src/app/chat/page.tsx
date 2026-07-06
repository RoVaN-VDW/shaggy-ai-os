"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { Send, MessageSquare, BookOpen, Database } from "lucide-react";

interface Provider {
  id: string;
  provider: string;
  model: string;
  status: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  latency?: number;
}

export default function ChatPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [useRag, setUseRag] = useState(false);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    supabase.from("model_providers").select("id, provider, model, status").then(({ data }) => {
      if (data) {
        setProviders(data);
        if (data.length > 0) setSelectedProviderId(data[0].id);
      }
    });
    supabase.from("knowledge_docs").select("id, name").eq("embedding_status", "indexed").then(({ data }) => {
      if (data) setDocs(data);
    });
    supabase.from("projects").select("id, name").then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  const send = async () => {
    if (!input.trim() || !selectedProviderId) return;

    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    const start = Date.now();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId,
          projectId: selectedProjectId || null,
          prompt: userMsg,
          useRag,
        }),
      });
      const data = await res.json();
      const latency = Date.now() - start;

      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `Error: ${data.error || "Unknown error"}` }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.output, citations: data.citations, latency }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Failed to send"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="h-full flex gap-4">
      <div className="w-72 flex flex-col gap-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedProviderId} onValueChange={(value) => setSelectedProviderId(value ?? "")}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-foreground">
                    {p.provider} ({p.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProvider && (
              <Badge variant={selectedProvider.status === "active" ? "default" : "secondary"}>
                {selectedProvider.status}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedProjectId} onValueChange={(value) => setSelectedProjectId(value ?? "")}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="none">None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> RAG
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Use knowledge base</Label>
              <Switch checked={useRag} onCheckedChange={setUseRag} />
            </div>
            {useRag && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{docs.length} indexed document(s) available</p>
                {docs.length === 0 && <p className="text-destructive">Upload and index documents first.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Chats</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">No saved chats yet.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col border-border bg-card">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Chat Studio
              {useRag && <Database className="w-3 h-3 text-primary" />}
            </CardTitle>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              {useRag ? "RAG" : "Direct"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">Start a conversation. Toggle RAG to include knowledge base context.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"}`}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground">Sources:</p>
                        <ul className="text-[10px] text-primary space-y-0.5">
                          {m.citations.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.latency && (
                      <div className="text-[10px] text-muted-foreground mt-1">{m.latency}ms</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type a message..."
              className="flex-1 border-border bg-background text-foreground"
              disabled={loading}
            />
            <Button onClick={send} disabled={loading || !input.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
