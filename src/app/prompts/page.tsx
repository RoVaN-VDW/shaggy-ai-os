"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, Save, Sparkles, Star, TriangleAlert, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";

type PromptRecord = {
  id: string;
  project_id: string | null;
  engine: string;
  type: string | null;
  title: string | null;
  prompt_text: string | null;
  rating: number;
  status: string;
  version: number;
  metadata: { tags?: string[] } | null;
};

type Draft = { id?: string; projectId: string; engine: string; type: string; title: string; text: string; rating: number; status: string; version: number };
const emptyDraft: Draft = { projectId: "none", engine: "general", type: "system", title: "", text: "", rating: 0, status: "draft", version: 1 };

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from("prompts").select("id, project_id, engine, type, title, prompt_text, rating, status, version, metadata").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
    ]).then(([promptResult, projectResult]) => {
      setLoading(false);
      if (promptResult.data) setPrompts(promptResult.data);
      if (projectResult.data) setProjects(projectResult.data);
      const firstError = promptResult.error || projectResult.error;
      if (firstError) setError(firstError.message);
    });
  }, []);

  function openPrompt(prompt: PromptRecord) {
    setDraft({ id: prompt.id, projectId: prompt.project_id || "none", engine: prompt.engine, type: prompt.type || "system", title: prompt.title || "", text: prompt.prompt_text || "", rating: prompt.rating, status: prompt.status, version: prompt.version });
    setNotice(null);
    setError(null);
  }

  function newPrompt() {
    setDraft(emptyDraft);
    setNotice(null);
    setError(null);
  }

  async function savePrompt() {
    if (!draft.title.trim() || !draft.text.trim()) {
      setError("A title and prompt body are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = { project_id: draft.projectId === "none" ? null : draft.projectId, engine: draft.engine, type: draft.type, title: draft.title.trim(), prompt_text: draft.text.trim(), rating: draft.rating, status: draft.status, version: draft.version };
    const query = draft.id
      ? supabase.from("prompts").update(payload).eq("id", draft.id).select("id, project_id, engine, type, title, prompt_text, rating, status, version, metadata").single()
      : supabase.from("prompts").insert(payload).select("id, project_id, engine, type, title, prompt_text, rating, status, version, metadata").single();
    const { data, error: saveError } = await query;
    setSaving(false);
    if (saveError || !data) {
      setError(saveError?.message || "Prompt could not be saved.");
      return;
    }
    setPrompts((current) => [data, ...current.filter((prompt) => prompt.id !== data.id)]);
    openPrompt(data);
    setNotice("Saved");
  }

  function structurePrompt() {
    const body = draft.text.trim();
    if (!body) {
      setError("Write the core instruction before structuring it.");
      return;
    }
    if (/^## Role/m.test(body)) {
      setNotice("Prompt already uses the SHAGGY structure.");
      return;
    }
    setDraft((current) => ({
      ...current,
      text: `## Role\nYou are responsible for the task described below.\n\n## Objective\n${body}\n\n## Constraints\n- Preserve factual accuracy.\n- State assumptions and blockers explicitly.\n- Do not perform external side effects without approval.\n\n## Output\nReturn a concise, actionable result with verification evidence where applicable.`,
    }));
    setNotice("Structured locally — review before saving");
  }

  async function copyPrompt() {
    if (!draft.text) return;
    await navigator.clipboard.writeText(draft.text);
    setNotice("Copied to clipboard");
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h1 className="text-xl font-bold text-foreground">Prompt Intelligence</h1><Badge variant="outline" className="ml-2 border-primary/20 text-primary">{prompts.length}</Badge></div><Button onClick={newPrompt}><Plus className="size-4" />New prompt</Button></div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><TriangleAlert className="size-4" />{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-4 min-h-0 border-border bg-card/75 backdrop-blur"><CardHeader><CardTitle className="text-sm text-muted-foreground">Library</CardTitle></CardHeader><CardContent className="p-2"><ScrollArea className="h-[calc(100vh-14rem)]"><div className="space-y-1">{loading && <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading prompts…</p>}{!loading && prompts.length === 0 && <p className="p-3 text-xs leading-5 text-muted-foreground">No saved prompts. Create a reusable instruction in the editor.</p>}{prompts.map((prompt) => <button type="button" key={prompt.id} onClick={() => openPrompt(prompt)} className={`w-full rounded-xl border p-3 text-left transition-colors ${draft.id === prompt.id ? "border-primary/30 bg-primary/[0.08]" : "border-transparent hover:border-border hover:bg-background/40"}`}><div className="flex items-start justify-between gap-2"><span className="line-clamp-1 text-sm font-medium text-foreground">{prompt.title || "Untitled prompt"}</span>{prompt.rating > 0 && <span className="flex items-center gap-1 text-[10px] text-amber-300"><Star className="size-3 fill-current" />{prompt.rating}</span>}</div><div className="mt-2 flex gap-1"><Badge variant="outline" className="text-[9px]">{prompt.engine}</Badge><Badge variant="outline" className="text-[9px]">{prompt.status}</Badge></div></button>)}</div></ScrollArea></CardContent></Card>

        <Card className="col-span-8 flex min-h-0 flex-col border-border bg-card/75 backdrop-blur"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm text-muted-foreground">{draft.id ? "Prompt editor" : "New prompt"}</CardTitle><div className="flex items-center gap-2">{notice && <span className="flex max-w-48 items-center gap-1 truncate text-xs text-emerald-400"><Check className="size-3 shrink-0" />{notice}</span>}<Button size="sm" variant="outline" onClick={() => void copyPrompt()} disabled={!draft.text}><Copy className="size-3" />Copy</Button><Button size="sm" onClick={() => void savePrompt()} disabled={saving || !draft.title.trim() || !draft.text.trim()}>{saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}Save</Button></div></CardHeader><CardContent className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-3"><div className="grid grid-cols-12 gap-3"><div className="col-span-5 grid gap-1.5"><Label htmlFor="prompt-title">Title</Label><Input id="prompt-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Prompt title" /></div><div className="col-span-3 grid gap-1.5"><Label>Project</Label><Select value={draft.projectId} onValueChange={(value) => setDraft((current) => ({ ...current, projectId: value ?? "none" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Global prompt</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2 grid gap-1.5"><Label>Engine</Label><Select value={draft.engine} onValueChange={(value) => setDraft((current) => ({ ...current, engine: value ?? "general" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="codex">Codex</SelectItem><SelectItem value="gemini">Gemini</SelectItem><SelectItem value="kimi">Kimi</SelectItem></SelectContent></Select></div><div className="col-span-2 grid gap-1.5"><Label>Status</Label><Select value={draft.status} onValueChange={(value) => setDraft((current) => ({ ...current, status: value ?? "draft" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div></div><Textarea value={draft.text} onChange={(event) => { setDraft((current) => ({ ...current, text: event.target.value })); setNotice(null); }} placeholder="Write the instruction, objective and constraints…" className="min-h-0 resize-none font-mono text-sm leading-6" /><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Structuring is deterministic and runs locally; it does not incur model costs.</p><Button variant="outline" onClick={structurePrompt} disabled={!draft.text.trim()}><Wand2 className="size-4 text-amber-300" />Structure prompt</Button></div></CardContent></Card>
      </div>
    </div>
  );
}
