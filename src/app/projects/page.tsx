"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { FolderKanban, ArrowRight } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string;
  health_score: number;
  status: string;
  type: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    supabase.from("projects").select("*").then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-[#f1f5f9]">Projects Hub</h1>
        </div>
        <Button className="bg-[#00d4ff] text-[#020617] hover:bg-[#00d4ff]/90">New Project</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="border-[#1e293b] bg-[#0a0f1e] hover:border-[#00d4ff]/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#f1f5f9]">{p.name}</CardTitle>
                <Badge variant="outline" className="border-[#1e293b] text-[#94a3b8] text-[10px]">{p.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#94a3b8] line-clamp-2">{p.description}</p>
              <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                <span>Health</span>
                <span className="text-[#00d4ff] font-semibold">{p.health_score}%</span>
              </div>
              <Progress value={p.health_score} className="h-1.5" />
              <div className="flex items-center justify-between pt-2">
                <Badge className="bg-[#111827] text-[#f1f5f9] border-[#1e293b]">{p.status}</Badge>
                <Button variant="ghost" size="sm" className="text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10">
                  Open <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
