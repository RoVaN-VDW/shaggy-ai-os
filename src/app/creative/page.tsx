"use client";

import { useEffect, useState } from "react";
import { Download, Image, Loader2, Music, Palette, Sparkles, TriangleAlert, Video, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth, supabase } from "@/lib/supabase/client";

const formats = [
  { id: "image", name: "Image", icon: Image, description: "Composition, lighting, palette and generation-ready prompt." },
  { id: "music", name: "Music", icon: Music, description: "Song structure, instrumentation, mood and production direction." },
  { id: "video", name: "Video", icon: Video, description: "Narrative, shot list, motion, sound and delivery specification." },
] as const;

export default function CreativePage() {
  const [providers, setProviders] = useState<{ id: string; provider: string; model: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [format, setFormat] = useState<(typeof formats)[number]["id"]>("image");
  const [providerId, setProviderId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from("model_providers").select("id, provider, model").eq("status", "active"),
      supabase.from("projects").select("id, name").order("name"),
    ]).then(([providerResult, projectResult]) => {
      if (providerResult.data) {
        setProviders(providerResult.data);
        setProviderId(providerResult.data[0]?.id || "");
      }
      if (projectResult.data) setProjects(projectResult.data);
      const firstError = providerResult.error || projectResult.error;
      if (firstError) setError(firstError.message);
    });
  }, []);

  async function generateBrief() {
    const concept = prompt.trim();
    if (!concept || !providerId) return;
    setGenerating(true);
    setError(null);
    setOutput("");
    const selectedFormat = formats.find((item) => item.id === format)!;
    const productionPrompt = `You are SHAGGY Creative Studio. Produce a professional ${selectedFormat.name.toLowerCase()} production brief for the concept below.\n\nConcept:\n${concept}\n\nInclude: creative intent, target audience, style direction, concrete production specification, generation-ready master prompt, negative constraints, and a quality-control checklist. Do not claim that media was rendered; return only the production brief.`;
    try {
      const response = await fetchWithAuth("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, projectId: projectId === "none" ? null : projectId, prompt: productionPrompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Creative dispatch failed.");
      setOutput(data.output);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creative dispatch failed.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadBrief() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shaggy-${format}-production-brief.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Palette className="size-5 text-primary" /><h1 className="text-xl font-bold text-foreground">Creative Studio</h1></div><Badge variant="outline" className="border-amber-300/25 text-amber-300">Production briefs</Badge></div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"><TriangleAlert className="size-4" />{error}</div>}
      <div className="grid grid-cols-3 gap-4">{formats.map((item) => <button type="button" key={item.id} onClick={() => setFormat(item.id)} className={`rounded-2xl border p-4 text-left backdrop-blur transition-all ${format === item.id ? "border-amber-300/40 bg-amber-300/[0.08] shadow-[0_14px_40px_rgba(240,180,41,.08)]" : "border-border bg-card/70 hover:border-primary/30"}`}><div className="flex items-center gap-2"><item.icon className={`size-4 ${format === item.id ? "text-amber-300" : "text-primary"}`} /><span className="text-sm font-semibold text-foreground">{item.name}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p></button>)}</div>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <Card className="col-span-5 flex min-h-0 flex-col border-border bg-card/75 backdrop-blur"><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Wand2 className="size-4 text-amber-300" />Creative direction</CardTitle></CardHeader><CardContent className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-3"><div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label>Model provider</Label><Select value={providerId} onValueChange={(value) => setProviderId(value ?? "")}><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger><SelectContent>{providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.provider} · {provider.model}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Project</Label><Select value={projectId} onValueChange={(value) => setProjectId(value ?? "none")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No project</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div></div><Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Describe the ${format} concept, audience, mood and constraints…`} className="min-h-0 resize-none text-sm leading-6" /><div><p className="mb-3 text-[10px] leading-4 text-muted-foreground">Generate calls the selected external model and records usage/cost in SHAGGY. It creates a production brief, not rendered media.</p><Button className="w-full bg-amber-300 text-background hover:bg-amber-300/90" onClick={() => void generateBrief()} disabled={generating || !prompt.trim() || !providerId}>{generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? "Generating brief…" : "Generate production brief"}</Button></div></CardContent></Card>

        <Card className="col-span-7 flex min-h-0 flex-col border-border bg-card/75 backdrop-blur"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm text-muted-foreground">Generated brief</CardTitle><Button size="sm" variant="outline" onClick={downloadBrief} disabled={!output}><Download className="size-3" />Download</Button></CardHeader><CardContent className="min-h-0 flex-1">{output ? <div className="h-full overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/45 p-4 text-sm leading-6 text-foreground">{output}</div> : <div className="grid h-full place-items-center rounded-xl border border-dashed border-border text-center"><div><Sparkles className="mx-auto mb-3 size-9 text-amber-300/35" /><p className="text-sm text-foreground">No production brief yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Choose a medium, describe the concept and explicitly start the provider call.</p></div></div>}</CardContent></Card>
      </div>
    </div>
  );
}
