"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { FileText, Plus, Download } from "lucide-react";

type Artifact = {
  id: string;
  title: string;
  type: string;
  content?: string;
  status: string;
};

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  useEffect(() => {
    supabase.from("artifacts").select("*").then(({ data }) => {
      if (data) setArtifacts(data);
    });
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-[#f1f5f9]">Artifact Studio</h1>
        </div>
        <Button className="bg-[#00d4ff] text-[#020617] hover:bg-[#00d4ff]/90">
          <Plus className="w-4 h-4 mr-1" /> New Artifact
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {artifacts.length === 0 && (
          <div className="col-span-4 text-sm text-[#94a3b8]">No artifacts yet.</div>
        )}
        {artifacts.map((a) => (
          <Card key={a.id} className="border-[#1e293b] bg-[#0a0f1e]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-[#f1f5f9]">{a.title}</CardTitle>
                <Badge variant="outline" className="border-[#1e293b] text-[#94a3b8] text-[10px]">{a.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#94a3b8] line-clamp-3 mb-3">{a.content || "No content preview."}</p>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${a.status === "published" ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30" : "bg-[#f0b429]/10 text-[#f0b429] border-[#f0b429]/30"}`}>{a.status}</Badge>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-[#94a3b8]">
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
