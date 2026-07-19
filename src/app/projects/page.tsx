"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, FolderKanban, Loader2, Plus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  description: string | null;
  health_score: number;
  status: string;
  type: string | null;
  created_at: string;
};

const emptyDraft = { name: "", description: "", type: "product" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    void supabase
      .from("projects")
      .select("id, name, description, health_score, status, type, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        setLoading(false);
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setProjects(data ?? []);
      });
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const { data, error: createError } = await supabase
      .from("projects")
      .insert({ name, description: draft.description.trim() || null, type: draft.type, status: "active", health_score: 0 })
      .select("id, name, description, health_score, status, type, created_at")
      .single();
    setSaving(false);
    if (createError || !data) {
      setError(createError?.message || "Project could not be created.");
      return;
    }
    setProjects((current) => [...current, data]);
    setDraft(emptyDraft);
    setCreateOpen(false);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Projects Hub</h1>
          <Badge variant="outline" className="ml-2 border-primary/20 text-primary">{projects.length} projects</Badge>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New project</Button>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><TriangleAlert className="size-4" />{error}</div>}

      {loading ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin text-primary" />Loading projects…</span></div>
      ) : projects.length === 0 ? (
        <button type="button" onClick={() => setCreateOpen(true)} className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border bg-card/30 text-center transition-colors hover:border-primary/40">
          <span><FolderKanban className="mx-auto mb-3 size-9 text-primary/50" /><strong className="block text-sm text-foreground">Create your first project</strong><span className="mt-1 block text-xs text-muted-foreground">Group conversations, knowledge and usage by initiative.</span></span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-4 overflow-auto pb-2">
          {projects.map((project) => (
            <Card key={project.id} className="group border-border bg-card/75 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_50px_rgba(0,0,0,.25)]">
              <CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base text-foreground">{project.name}</CardTitle><Badge variant="outline" className="shrink-0 border-border text-[10px] text-muted-foreground">{project.type || "project"}</Badge></div></CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-10 line-clamp-2 text-sm leading-5 text-muted-foreground">{project.description || "No project description yet."}</p>
                <div><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Health</span><span className="font-semibold text-primary">{project.health_score}%</span></div><Progress value={project.health_score} className="h-1.5" /></div>
                <div className="flex items-center justify-between border-t border-border/70 pt-3"><Badge className="bg-emerald-400/10 text-emerald-400">{project.status}</Badge><Button variant="ghost" size="sm" className="text-primary" onClick={() => setSelected(project)}>Open <ArrowRight className="size-3" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border bg-popover/95 sm:max-w-lg">
          <form onSubmit={createProject} className="grid gap-4">
            <DialogHeader><DialogTitle>Create project</DialogTitle><DialogDescription>Set up a new workspace for conversations, knowledge and tracked provider usage.</DialogDescription></DialogHeader>
            <div className="grid gap-2"><Label htmlFor="project-name">Name</Label><Input id="project-name" autoFocus required maxLength={100} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Project name" /></div>
            <div className="grid gap-2"><Label htmlFor="project-description">Description</Label><Textarea id="project-description" maxLength={600} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What is this project responsible for?" /></div>
            <div className="grid gap-2"><Label>Type</Label><Select value={draft.type} onValueChange={(value) => setDraft((current) => ({ ...current, type: value ?? "product" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="product">Product</SelectItem><SelectItem value="business">Business</SelectItem><SelectItem value="research">Research</SelectItem><SelectItem value="personal">Personal</SelectItem></SelectContent></Select></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || !draft.name.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create project</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="border-border bg-popover/95 sm:max-w-lg">
          {selected && <><DialogHeader><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.description || "No description supplied."}</DialogDescription></DialogHeader><div className="grid grid-cols-3 gap-3"><Metric label="Status" value={selected.status} /><Metric label="Health" value={`${selected.health_score}%`} /><Metric label="Type" value={selected.type || "project"} /></div><p className="text-xs text-muted-foreground">Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(selected.created_at))}</p><DialogFooter showCloseButton /></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p></div>;
}
