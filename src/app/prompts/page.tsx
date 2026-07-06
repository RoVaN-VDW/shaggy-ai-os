"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Star, Copy, Wand2 } from "lucide-react";

const prompts = [
  { id: 1, title: "System Continuity Handoff", tags: ["continuity", "handoff"], quality: 96 },
  { id: 2, title: "Council Run Facilitator", tags: ["council", "strategy"], quality: 92 },
  { id: 3, title: "Code Review Gate", tags: ["code", "review"], quality: 88 },
];

export default function PromptsPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-[#f1f5f9]">Prompt Intelligence</h1>
        </div>
        <Button className="bg-[#00d4ff] text-[#03080b] hover:bg-[#00d4ff]/90">
          <Plus className="w-4 h-4 mr-1" /> New Prompt
        </Button>
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-4 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">Library</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100%-3rem)] px-4">
              <div className="space-y-2 pb-4">
                {prompts.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] hover:border-[#f0b429]/40 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#f1f5f9]">{p.title}</span>
                      <Star className="w-3 h-3 text-[#f0b429]" />
                    </div>
                    <div className="flex gap-1 mt-2">
                      {p.tags.map((t) => (
                        <Badge key={t} variant="outline" className="border-[#1e293b] text-[#94a3b8] text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] text-[#00d4ff]">Quality score: {p.quality}%</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="col-span-8 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">Prompt Editor</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <Input placeholder="Prompt title" className="border-[#1e293b] bg-[#03080b] text-[#f1f5f9]" />
            <Textarea placeholder="Write your system prompt here..." className="flex-1 border-[#1e293b] bg-[#03080b] text-[#f1f5f9] resize-none min-h-[200px]" />
            <div className="flex gap-2">
              <Button className="bg-[#00d4ff] text-[#03080b] hover:bg-[#00d4ff]/90"><Wand2 className="w-4 h-4 mr-1" /> Optimize</Button>
              <Button variant="outline" className="border-[#1e293b] text-[#f1f5f9]"><Copy className="w-4 h-4 mr-1" /> Copy</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
