"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Database, Loader2, Network, Plus, Search, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";

type Room = { id: string; project_id: string | null; name: string; mode: string; source_policy: string; created_at: string };
type Source = { id: string; room_id: string; reliability_score: number; freshness: string; created_at: string };

export default function KnowledgePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", projectId: "none", mode: "standard", policy: "verify-first" });

  useEffect(() => {
    void Promise.all([
      supabase.from("knowledge_rooms").select("id, project_id, name, mode, source_policy, created_at").order("created_at"),
      supabase.from("knowledge_sources").select("id, room_id, reliability_score, freshness, created_at"),
      supabase.from("projects").select("id, name").order("name"),
    ]).then(([roomResult, sourceResult, projectResult]) => {
      setLoading(false);
      if (roomResult.data) {
        setRooms(roomResult.data);
        setSelectedId(roomResult.data[0]?.id || "");
      }
      if (sourceResult.data) setSources(sourceResult.data);
      if (projectResult.data) setProjects(projectResult.data);
      const firstError = roomResult.error || sourceResult.error || projectResult.error;
      if (firstError) setError(firstError.message);
    });
  }, []);

  const filteredRooms = useMemo(() => rooms.filter((room) => room.name.toLowerCase().includes(query.trim().toLowerCase())), [rooms, query]);
  const selectedRoom = rooms.find((room) => room.id === selectedId) || null;
  const selectedSources = sources.filter((source) => source.room_id === selectedId);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: createError } = await supabase
      .from("knowledge_rooms")
      .insert({ name: draft.name.trim(), project_id: draft.projectId === "none" ? null : draft.projectId, mode: draft.mode, source_policy: draft.policy })
      .select("id, project_id, name, mode, source_policy, created_at")
      .single();
    setSaving(false);
    if (createError || !data) {
      setError(createError?.message || "Knowledge room could not be created.");
      return;
    }
    setRooms((current) => [...current, data]);
    setSelectedId(data.id);
    setDraft({ name: "", projectId: "none", mode: "standard", policy: "verify-first" });
    setCreateOpen(false);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /><h1 className="text-xl font-bold text-foreground">Knowledge Rooms</h1><Badge variant="outline" className="ml-2 border-primary/20 text-primary">{rooms.length}</Badge></div><Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />New room</Button></div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><TriangleAlert className="size-4" />{error}</div>}
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search knowledge rooms…" className="pl-9" /></div>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-4 min-h-0 border-border bg-card/75 backdrop-blur"><CardHeader><CardTitle className="text-sm text-muted-foreground">Rooms</CardTitle></CardHeader><CardContent className="p-2"><ScrollArea className="h-[calc(100vh-17rem)]"><div className="space-y-1">{loading && <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading rooms…</p>}{!loading && filteredRooms.length === 0 && <p className="p-3 text-xs text-muted-foreground">{query ? "No rooms match your search." : "No knowledge rooms yet."}</p>}{filteredRooms.map((room) => { const count = sources.filter((source) => source.room_id === room.id).length; return <button type="button" key={room.id} onClick={() => setSelectedId(room.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === room.id ? "border-primary/30 bg-primary/[0.08]" : "border-transparent hover:border-border hover:bg-background/40"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-foreground">{room.name}</span><Badge variant="outline" className="text-[9px]">{room.mode}</Badge></div><div className="mt-2 text-[10px] text-muted-foreground">{count} source{count === 1 ? "" : "s"} · {room.source_policy}</div></button>; })}</div></ScrollArea></CardContent></Card>

        <Card className="col-span-8 flex min-h-0 flex-col border-border bg-card/75 backdrop-blur"><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Network className="size-4 text-amber-300" />Room provenance</CardTitle></CardHeader><CardContent className="min-h-0 flex-1">{selectedRoom ? <div className="grid h-full grid-rows-[auto_1fr] gap-4"><div className="grid grid-cols-3 gap-3"><Metric label="Room" value={selectedRoom.name} /><Metric label="Mode" value={selectedRoom.mode} /><Metric label="Source policy" value={selectedRoom.source_policy} /></div><ScrollArea className="h-[calc(100vh-20rem)]"><div className="space-y-2">{selectedSources.length === 0 && <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center"><Database className="mb-3 size-8 text-primary/40" /><p className="text-sm text-foreground">No sources linked</p><p className="mt-1 text-xs text-muted-foreground">Upload documents in Upload Hub, then link provenance in this room.</p></div>}{selectedSources.map((source) => <div key={source.id} className="flex items-center justify-between rounded-xl border border-border bg-background/45 p-3"><div><p className="text-xs font-medium text-foreground">Knowledge source</p><p className="mt-1 text-[10px] text-muted-foreground">Freshness {new Date(source.freshness).toLocaleDateString()}</p></div><Badge className="bg-primary/10 text-primary">Reliability {source.reliability_score}%</Badge></div>)}</div></ScrollArea></div> : <div className="grid h-full place-items-center text-center"><div><Network className="mx-auto mb-3 size-10 text-primary/30" /><p className="text-sm text-muted-foreground">Select or create a knowledge room.</p></div></div>}</CardContent></Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="border-border bg-popover/95 sm:max-w-lg"><form className="grid gap-4" onSubmit={createRoom}><DialogHeader><DialogTitle>Create knowledge room</DialogTitle><DialogDescription>Define a provenance boundary for project knowledge and future RAG retrieval.</DialogDescription></DialogHeader><div className="grid gap-1.5"><Label htmlFor="room-name">Name</Label><Input id="room-name" required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Room name" /></div><div className="grid grid-cols-3 gap-3"><div className="grid gap-1.5"><Label>Project</Label><Select value={draft.projectId} onValueChange={(value) => setDraft((current) => ({ ...current, projectId: value ?? "none" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Global</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Mode</Label><Select value={draft.mode} onValueChange={(value) => setDraft((current) => ({ ...current, mode: value ?? "standard" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="research">Research</SelectItem><SelectItem value="restricted">Restricted</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>Policy</Label><Select value={draft.policy} onValueChange={(value) => setDraft((current) => ({ ...current, policy: value ?? "verify-first" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="verify-first">Verify first</SelectItem><SelectItem value="trusted-only">Trusted only</SelectItem><SelectItem value="exploratory">Exploratory</SelectItem></SelectContent></Select></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || !draft.name.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create room</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-background/45 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p></div>;
}
