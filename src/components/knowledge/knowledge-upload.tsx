"use client";

import { ChangeEvent, useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchWithAuth } from "@/lib/supabase/client";

type KnowledgeDoc = {
  id: string;
  name: string;
  file_type: string;
  size_bytes: number;
  embedding_status: string;
  created_at: string;
  storage_path?: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  processing: "bg-primary/10 text-primary border-primary/30",
  indexed: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  error: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_LABELS: Record<string, string> = {
  indexed: "preview indexed",
};

export function KnowledgeUpload({ docs }: { docs: KnowledgeDoc[] }) {
  const [documents, setDocuments] = useState(docs);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);

    try {
      setProgress(45);
      const response = await fetchWithAuth("/api/upload", { method: "POST", body: formData });
      setProgress(85);
      const data = await response.json();
      if (!response.ok || !data.document) throw new Error(data.error || "Upload failed.");
      setDocuments((current) => [data.document, ...current]);
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
      window.setTimeout(() => setProgress(0), 400);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(doc: KnowledgeDoc) {
    if (!window.confirm(`Remove “${doc.name}” from SHAGGY knowledge? This cannot be undone.`)) return;
    setDeleting(doc.id);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/knowledge/${doc.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error || "Document could not be removed.");
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      if (data.warning) setError(data.warning);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document could not be removed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="grid h-full grid-cols-12 gap-4">
      <Card className="col-span-8 h-full border-border bg-card/75 backdrop-blur">
        <CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="size-4 text-primary" />Knowledge documents</CardTitle><Badge className="border border-primary/30 bg-primary/10 text-primary">{documents.length} docs</Badge></CardHeader>
        <CardContent className="p-0"><ScrollArea className="h-[calc(100vh-20rem)] px-4"><div className="space-y-2 pb-4">{documents.length === 0 && <div className="rounded-xl border border-dashed border-border py-12 text-center"><FileText className="mx-auto mb-3 size-7 text-primary/40" /><p className="text-xs text-muted-foreground">No documents uploaded yet.</p></div>}{documents.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-xl border border-border bg-background/45 p-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><FileText className="size-4 text-primary" /></div><div className="min-w-0"><div className="truncate text-sm font-medium text-foreground">{doc.name}</div><div className="text-[10px] text-muted-foreground">{formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}</div></div></div><div className="flex items-center gap-2"><Badge className={STATUS_STYLES[doc.embedding_status] || STATUS_STYLES.pending}>{STATUS_LABELS[doc.embedding_status] || doc.embedding_status}</Badge><Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(doc)} disabled={deleting === doc.id}>{deleting === doc.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}<span className="sr-only">Remove {doc.name}</span></Button></div></div>)}</div></ScrollArea></CardContent>
      </Card>

      <Card className="col-span-4 h-fit border-border bg-card/75 p-4 backdrop-blur"><div className="space-y-4"><button type="button" className="w-full rounded-xl border border-dashed border-border bg-background/40 p-5 text-center transition-colors hover:border-primary/40" onClick={() => inputRef.current?.click()} disabled={uploading}><Upload className="mx-auto mb-2 size-8 text-primary" /><p className="text-sm font-medium text-foreground">Upload document</p><p className="mt-1 text-[10px] text-muted-foreground">PDF, TXT or Markdown · maximum 10 MB</p></button><input ref={inputRef} type="file" accept=".pdf,.txt,.md,.markdown" className="hidden" onChange={handleUpload} /><Button className="w-full" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{uploading ? "Uploading…" : "Select file"}</Button>{progress > 0 && <div className="space-y-1"><div className="text-center text-[10px] text-muted-foreground">{progress < 100 ? "Uploading and registering…" : "Upload complete"}</div><Progress value={progress} className="h-1" /></div>}{error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}<div className="space-y-1 text-[10px] leading-4 text-muted-foreground"><p>• Stored in the private Supabase bucket</p><p>• Preview indexing covers up to 3,000 characters and the first 10 PDF pages</p><p>• Preview-indexed content becomes available to Chat RAG</p></div></div></Card>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
