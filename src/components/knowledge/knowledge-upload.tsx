"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#f0b429]/10 text-[#f0b429] border-[#f0b429]/30",
  processing: "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30",
  indexed: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30",
  error: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30",
};

export function KnowledgeUpload({ docs }: { docs: { id: string; name: string; file_type: string; size_bytes: number; embedding_status: string; created_at: string }[] }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(25);

    const path = `docs/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("knowledge").upload(path, file);
    setProgress(70);

    if (uploadError) {
      setUploading(false);
      setProgress(0);
      alert(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { error: dbError } = await supabase.from("knowledge_docs").insert({
      name: file.name,
      file_type: file.type || file.name.split(".").pop() || "unknown",
      size_bytes: file.size,
      storage_path: path,
      embedding_status: "pending",
    });

    setProgress(100);
    setUploading(false);

    if (dbError) {
      alert(`Database error: ${dbError.message}`);
    } else {
      window.location.reload();
    }
  };

  const handleDelete = async (doc: { id: string; storage_path?: string }) => {
    if (doc.storage_path) {
      await supabase.storage.from("knowledge").remove([doc.storage_path]);
    }
    await supabase.from("knowledge_docs").delete().eq("id", doc.id);
    window.location.reload();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4">
      <div className="col-span-8">
        <Card className="h-full border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00d4ff]" /> Knowledge Documents
            </CardTitle>
            <Badge className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">{docs.length} docs</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-20rem)] px-4">
              <div className="space-y-2 pb-4">
                {docs.length === 0 && (
                  <p className="text-xs text-[#94a3b8]">No documents uploaded yet.</p>
                )}
                {docs.map((d) => (
                  <div key={d.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#00d4ff]/10">
                        <FileText className="w-4 h-4 text-[#00d4ff]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#f1f5f9] truncate">{d.name}</div>
                        <div className="text-[10px] text-[#94a3b8]">
                          {formatSize(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_STYLES[d.embedding_status] || STATUS_STYLES.pending}>{d.embedding_status}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[#ef4444] hover:bg-[#ef4444]/10"
                        onClick={() => handleDelete(d)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-4">
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur p-4">
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-dashed border-[#1e293b] bg-[#03080b] text-center">
              <Upload className="w-8 h-8 text-[#00d4ff] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#f1f5f9]">Upload document</p>
              <p className="text-[10px] text-[#94a3b8] mt-1">PDF, TXT, Markdown supported</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown"
              className="hidden"
              onChange={handleUpload}
            />

            <Button
              className="w-full bg-[#00d4ff] text-[#0a0f1e] hover:bg-[#00d4ff]/90"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Select file
            </Button>

            {uploading && (
              <div className="space-y-1">
                <div className="text-[10px] text-[#94a3b8] text-center">Uploading...</div>
                <Progress value={progress} className="h-1" />
              </div>
            )}

            <div className="text-[10px] text-[#64748b] space-y-1">
              <p>• Documents are stored in Supabase Storage</p>
              <p>• Embeddings are queued for RAG</p>
              <p>• Status updates to &quot;indexed&quot; when ready</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
