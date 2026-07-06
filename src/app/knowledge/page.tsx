"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase/client";
import { BookOpen, Plus, Search, Network } from "lucide-react";

type Room = {
  id: string;
  name: string;
  description: string;
  type: string;
  source_count: number;
  status: string;
};

export default function KnowledgePage() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    supabase.from("knowledge_rooms").select("*").then(({ data }) => {
      if (data) setRooms(data);
    });
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-[#f1f5f9]">Knowledge Rooms</h1>
        </div>
        <Button className="bg-[#00d4ff] text-[#03080b] hover:bg-[#00d4ff]/90">
          <Plus className="w-4 h-4 mr-1" /> New Room
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#94a3b8]" />
          <Input placeholder="Search knowledge sources..." className="pl-9 border-[#1e293b] bg-[#03080b] text-[#f1f5f9]" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-4 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8]">Rooms</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100%-3rem)] px-4">
              <div className="space-y-2 pb-4">
                {rooms.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] hover:border-[#00d4ff]/40 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#f1f5f9]">{r.name}</span>
                      <Badge variant="outline" className="border-[#1e293b] text-[#94a3b8] text-[10px]">{r.type}</Badge>
                    </div>
                    <p className="text-xs text-[#94a3b8] line-clamp-2">{r.description}</p>
                    <div className="mt-2 text-[10px] text-[#00d4ff]">{r.source_count} sources · {r.status}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="col-span-8 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Network className="w-4 h-4 text-[#f0b429]" /> Knowledge Graph
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Network className="w-12 h-12 text-[#00d4ff]/40 mx-auto mb-3" />
              <p className="text-sm text-[#94a3b8]">Interactive graph visualization coming in v0.2.</p>
              <p className="text-xs text-[#64748b]">Nodes, edges, vector embeddings and source provenance.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
