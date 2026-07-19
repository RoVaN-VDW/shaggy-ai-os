"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileText, Loader2, Plus, Save, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";

type Artifact = {
  id: string;
  project_id: string | null;
  title: string;
  type: string;
  content: string | null;
  status: string;
  version: number;
  updated_at: string;
};

type Draft = { id?: string; projectId: string; title: string; type: string; content: string; status: string; version: number };
const emptyDraft: Draft = { projectId: "none", title: "", type: "document", content: "", status: "draft", version: 1 };

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from("artifacts").select("id, project_id, title, type, content, status, version, updated_at").order("updated_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
    ]).then(([artifactResult, projectResult]) => {
      setLoading(false);
      if (artifactResult.data) setArtifacts(artifactResult.data);
      if (projectResult.data) setProjects(projectResult.data);
      const firstError = artifactResult.error || projectResult.error;
      if (firstError) setError(firstError.message);
    });
  }, []);

  function openArtifact(artifact: Artifact) {
    setDraft({ id: artifact.id, projectId: artifact.project_id || "none", title: artifact.title, type: artifact.type, content: artifact.content || "", status: artifact.status, version: artifact.version });
    setSaved(false);
    setError(null);
  }

  function newArtifact() {
    setDraft(emptyDraft);
    setSaved(false);
    setError(null);
  }

  async function saveArtifact() {
    if (!draft.title.trim()) {
      setError("Artifact title is required.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    const payload = {
      project_id: draft.projectId === "none" ? null : draft.projectId,
      title: draft.title.trim(),
      type: draft.type,
      content: draft.content,
      status: draft.status,
      version: draft.version,
      updated_at: new Date().toISOString(),
    };
    const query = draft.id
      ? supabase.from("artifacts").update(payload).eq("id", draft.id).select("id, project_id, title, type, content, status, version, updated_at").single()
      : supabase.from("artifacts").insert(payload).select("id, project_id, title, type, content, status, version, updated_at").single();
    const { data, error: saveError } = await query;
    setSaving(false);
    if (saveError || !data) {
      setError(saveError?.message || "Artifact could not be saved.");
      return;
    }
    setArtifacts((current) => [data, ...current.filter((artifact) => artifact.id !== data.id)]);
    setDraft({ id: data.id, projectId: data.project_id || "none", title: data.title, type: data.type, content: data.content || "", status: data.status, version: data.version });
    setSaved(true);
  }

  function downloadArtifact() {
    if (!draft.content) return;
    const blob = new Blob([draft.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "artifact"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="size-5 text-primary" /><h1 className="text-xl font-bold text-foreground">Artifact Studio</h1><Badge variant="outline" className="ml-2 border-primary/20 text-primary">{artifacts.length}</Badge></div><Button onClick={newArtifact}><Plus className="size-4" />New artifact</Button></div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><TriangleAlert className="size-4" />{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-4 min-h-0 border-border bg-card/75 backdrop-blur"><CardHeader><CardTitle className="text-sm text-muted-foreground">Library</CardTitle></CardHeader><CardContent className="p-2"><ScrollArea className="h-[calc(100vh-14rem)]"><div className="space-y-1">{loading && <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading artifacts…</p>}{!loading && artifacts.length === 0 && <p className="p-3 text-xs leading-5 text-muted-foreground">No artifacts yet. Create a document, report or handoff in the editor.</p>}{artifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => openArtifact(artifact)} className={`w-full rounded-xl border p-3 text-left transition-colors ${draft.id === artifact.id ? "border-primary/30 bg-primary/[0.08]" : "border-transparent hover:border-border hover:bg-background/40"}`}><div className="flex items-start justify-between gap-2"><span className="line-clamp-1 text-sm font-medium text-foreground">{artifact.title}</span><Badge variant="outline" className="text-[9px]">v{artifact.version}</Badge></div><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{artifact.type}</span><span>{artifact.status}</span></div></button>)}</div></ScrollArea></CardContent></Card>

        <Card className="col-span-8 flex min-h-0 flex-col border-border bg-card/75 backdrop-blur"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm text-muted-foreground">{draft.id ? "Edit artifact" : "New artifact"}</CardTitle><div className="flex items-center gap-2">{saved && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3" />Saved</span>}<Button size="sm" variant="outline" onClick={downloadArtifact} disabled={!draft.content}><Download className="size-3" />Download</Button><Button size="sm" onClick={() => void saveArtifact()} disabled={saving || !draft.title.trim()}>{saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}Save</Button></div></CardHeader><CardContent className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3"><div className="grid grid-cols-12 gap-3"><div className="col-span-5 grid gap-1.5"><Label htmlFor="artifact-title">Title</Label><Input id="artifact-title" value={draft.title} onChange={(event) => { setDraft((current) => ({ ...current, title: event.target.value })); setSaved(false); }} placeholder="Artifact title" /></div><div className="col-span-3 grid gap-1.5"><Label>Project</Label><Select value={draft.projectId} onValueChange={(value) => { setDraft((current) => ({ ...current, projectId: value ?? "none" })); setSaved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2 grid gap-1.5"><Label>Type</Label><Select value={draft.type} onValueChange={(value) => setDraft((current) => ({ ...current, type: value ?? "document" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Document</SelectItem><SelectItem value="report">Report</SelectItem><SelectItem value="handoff">Handoff</SelectItem><SelectItem value="spec">Specification</SelectItem></SelectContent></Select></div><div className="col-span-2 grid gap-1.5"><Label>Status</Label><Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value ?? "draft" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="review">Review</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div></div><Textarea value={draft.content} onChange={(event) => { setDraft((current) => ({ ...current, content: event.target.value })); setSaved(false); }} placeholder="Write the artifact in Markdown…" className="min-h-0 resize-none font-mono text-sm leading-6" /></CardContent></Card>
      </div>
    </div>
  );
}
