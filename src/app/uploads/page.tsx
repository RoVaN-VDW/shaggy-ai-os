"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeUpload } from "@/components/knowledge/knowledge-upload";
import { useCockpitData } from "@/hooks/useCockpitData";
import { FileCheck2, Shield, UploadCloud } from "lucide-react";

export default function UploadsPage() {
  const { knowledgeDocs, loading, error } = useCockpitData();
  const indexed = knowledgeDocs.filter((doc) => doc.embedding_status === "indexed").length;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UploadCloud className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Upload Hub</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileCheck2 className="size-4 text-emerald-400" /> {indexed} indexed · {knowledgeDocs.length} total
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid flex-1 min-h-0 grid-cols-12 gap-4">
        <div className="col-span-8 min-h-0">
          <KnowledgeUpload docs={knowledgeDocs} />
        </div>
        <Card className="col-span-4 border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="size-4 text-emerald-400" /> Ingestion policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-foreground">
            <Policy label="Accepted" value="PDF, Markdown, plain text" />
            <Policy label="Maximum size" value="10 MB per document" />
            <Policy label="Storage" value="Private Supabase bucket" />
            <Policy label="Indexing" value="OpenAI text-embedding-3-small" />
            <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-3 leading-5">
              Files are stored first and then indexed for project-aware RAG. Failed metadata writes automatically roll back the storage upload.
            </div>
            {loading && <p className="animate-pulse">Refreshing document state…</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3">
      <span>{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
