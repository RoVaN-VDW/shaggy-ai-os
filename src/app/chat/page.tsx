"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Cloud, Database, HardDrive, Loader2, MessageSquare, Pause, Play, Plus, Send, Square, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSpeechOutput } from "@/features/voice/speech-output-provider";
import { fetchWithAuth, supabase } from "@/lib/supabase/client";

type Provider = { id: string; provider: string; model: string; status: string };
type Message = { role: "user" | "assistant"; content: string; citations?: string[]; latency?: number };
type ChatSession = { id: string; title: string; updated_at: string };

export default function ChatPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("none");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [useRag, setUseRag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechOutput();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    void Promise.all([
      supabase.from("model_providers").select("id, provider, model, status").eq("status", "active"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("knowledge_docs").select("id, name").eq("embedding_status", "indexed"),
      supabase.from("chat_sessions").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(20),
    ]).then(([providerResult, projectResult, docsResult, sessionResult]) => {
      if (providerResult.data) {
        setProviders(providerResult.data);
        setSelectedProviderId(providerResult.data[0]?.id || "");
      }
      if (projectResult.data) setProjects(projectResult.data);
      if (docsResult.data) setDocs(docsResult.data);
      if (sessionResult.data) setSessions(sessionResult.data);
      const firstError = providerResult.error || projectResult.error || docsResult.error || sessionResult.error;
      if (firstError) setError(firstError.message);
    });
  }, []);

  async function openSession(sessionId: string) {
    speech.stop();
    setError(null);
    setSelectedSessionId(sessionId);
    const { data, error: loadError } = await supabase
      .from("chat_messages")
      .select("role, content, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setMessages(
      (data ?? []).map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: message.content,
        citations: Array.isArray(message.metadata?.citations) ? message.metadata.citations : undefined,
      }))
    );
  }

  function newConversation() {
    speech.stop();
    setSelectedSessionId("");
    setMessages([]);
    setError(null);
  }

  async function ensureSession(firstPrompt: string) {
    if (selectedSessionId) return selectedSessionId;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Your session expired. Please sign in again.");
    const { data, error: createError } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: authData.user.id,
        provider_id: selectedProviderId,
        project_id: selectedProjectId === "none" ? null : selectedProjectId,
        title: firstPrompt.slice(0, 72),
      })
      .select("id, title, updated_at")
      .single();
    if (createError || !data) throw new Error(createError?.message || "Chat session could not be created.");
    setSelectedSessionId(data.id);
    setSessions((current) => [data, ...current]);
    return data.id;
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || !selectedProviderId || loading) return;
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    setError(null);
    const startedAt = Date.now();

    try {
      const sessionId = await ensureSession(prompt);
      const response = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId,
          projectId: selectedProjectId === "none" ? null : selectedProjectId,
          prompt,
          useRag,
          sessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat request failed.");
      const requestId = `chat-${sessionId}-${Date.now()}`;
      setMessages((current) => [...current, { role: "assistant", content: data.output, citations: data.citations, latency: Date.now() - startedAt }]);
      if (data.persistence === "partial" && Array.isArray(data.warnings)) {
        setError(data.warnings.join(" "));
      }
      speech.speakAutomatically(data.output, { requestId });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Chat request failed.";
      setError(message);
      setMessages((current) => [...current, { role: "assistant", content: `Request failed: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  return (
    <div className="h-full flex gap-4">
      <aside className="w-72 flex flex-col gap-3 min-h-0">
        <Card className="border-border bg-card/80"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Runtime</CardTitle></CardHeader><CardContent className="space-y-3">
          <Select value={selectedProviderId} onValueChange={(value) => setSelectedProviderId(value ?? "")}><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger><SelectContent>{providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.provider} · {provider.model}</SelectItem>)}</SelectContent></Select>
          {selectedProvider && <Badge variant="outline" className="border-emerald-400/25 text-emerald-400">{selectedProvider.status}</Badge>}
          {providers.length === 0 && <p className="text-xs text-amber-300">No active provider configured.</p>}
        </CardContent></Card>

        <Card className="border-border bg-card/80"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Context</CardTitle></CardHeader><CardContent className="space-y-4">
          <Select value={selectedProjectId} onValueChange={(value) => setSelectedProjectId(value ?? "none")}><SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger><SelectContent><SelectItem value="none">No project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
          <div className="flex items-center justify-between"><Label className="flex items-center gap-2 text-xs"><BookOpen className="size-3 text-primary" /> Knowledge RAG</Label><Switch checked={useRag} onCheckedChange={setUseRag} /></div>
          {useRag && <p className="text-[11px] text-muted-foreground">{docs.length} indexed source{docs.length === 1 ? "" : "s"} available</p>}
        </CardContent></Card>

        <Card className="border-border bg-card/80 flex-1 min-h-0"><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm text-muted-foreground">Conversations</CardTitle><Button size="icon" variant="ghost" className="size-7" onClick={newConversation} title="New conversation"><Plus className="size-3" /></Button></CardHeader><CardContent className="p-2"><ScrollArea className="h-[calc(100vh-25rem)]"><div className="space-y-1">{sessions.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No saved conversations.</p>}{sessions.map((session) => <Button key={session.id} variant="ghost" className={`h-auto w-full justify-start whitespace-normal px-2 py-2 text-left text-xs ${selectedSessionId === session.id ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} onClick={() => void openSession(session.id)}>{session.title}</Button>)}</div></ScrollArea></CardContent></Card>
      </aside>

      <Card className="flex-1 flex flex-col border-border bg-card/80 min-w-0"><CardHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4 text-primary" />Chat Studio</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/25 text-primary text-[10px]">
              {speech.language === "nl-BE" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
              {speech.language === "nl-BE" ? "NL · Cloud" : "EN · Local"}
            </Badge>
            {speech.status === "speaking" && <Button size="icon" variant="ghost" className="size-7" title="Pause speech" onClick={speech.pause}><Pause className="size-3" /></Button>}
            {speech.status === "paused" && <Button size="icon" variant="ghost" className="size-7" title="Resume speech" onClick={() => void speech.resume()}><Play className="size-3" /></Button>}
            {(speech.status === "understanding" || speech.status === "speaking" || speech.status === "paused") && <Button size="icon" variant="ghost" className="size-7" title="Stop speech" onClick={speech.stop}><Square className="size-3" /></Button>}
            <Badge variant="outline" className="border-primary/25 text-primary text-[10px]">{useRag ? "RAG" : "Direct"}</Badge>
          </div>
        </div>
        {speech.error && <p role="alert" className="mt-2 text-xs text-destructive">{speech.error}</p>}
      </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
          {error && <div role="alert" className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>}
          <ScrollArea className="flex-1 p-4"><div className="space-y-3">
            {messages.length === 0 && <div className="grid place-items-center py-24 text-center"><Database className="mb-4 size-8 text-primary/50" /><p className="text-sm font-medium">Start a focused conversation</p><p className="mt-1 text-xs text-muted-foreground">Choose a model and optionally attach project knowledge.</p></div>}
            {messages.map((message, index) => {
              const requestId = `message-${selectedSessionId || "draft"}-${index}`;
              const active = speech.activeRequestId === requestId;
              return <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-muted text-foreground"}`}>
                  <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                  {message.citations?.length ? <div className="mt-3 border-t border-border/50 pt-2 text-[10px] text-primary">Sources: {message.citations.join(" · ")}</div> : null}
                  <div className={`mt-2 flex items-center gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.latency ? <span className="text-[10px] opacity-65">{message.latency} ms</span> : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[10px]"
                      title={speech.language === "nl-BE" ? "Send this text to Microsoft Vlaamse TTS" : "Speak locally with Sentinel K"}
                      onClick={() => active ? speech.stop() : void speech.speak(message.content, { requestId })}
                    >
                      {active ? <Square className="size-3" /> : <Volume2 className="size-3" />}
                      {active ? "Stop" : "Speak"}
                    </Button>
                  </div>
                </div>
              </div>;
            })}
            {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin text-primary" /> Model is thinking…</div>}
            <div ref={bottomRef} />
          </div></ScrollArea>
          <div className="flex gap-2 border-t border-border p-3"><Input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Message SHAGGY…" disabled={loading} /><Button onClick={() => void send()} disabled={loading || !input.trim() || !selectedProviderId}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
