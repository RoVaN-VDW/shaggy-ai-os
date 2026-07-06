"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Image, Music, Video, Wand2, Download } from "lucide-react";

const tools = [
  { name: "Image", icon: Image, desc: "Generate visuals from text prompts." },
  { name: "Music", icon: Music, desc: "Create AI music and soundscapes." },
  { name: "Video", icon: Video, desc: "Generate avatar and motion videos." },
];

export default function CreativePage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5 text-[#00d4ff]" />
        <h1 className="text-xl font-bold text-[#f1f5f9]">Creative Studio</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {tools.map((t) => (
          <Card key={t.name} className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur hover:border-[#f0b429]/40 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[#f1f5f9] flex items-center gap-2">
                <t.icon className="w-4 h-4 text-[#f0b429]" /> {t.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#94a3b8]">{t.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="flex-1 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">Generation Canvas</CardTitle></CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <Textarea placeholder="Describe what you want to create..." className="flex-1 border-[#1e293b] bg-[#03080b] text-[#f1f5f9] resize-none min-h-[120px]" />
          <div className="flex gap-2">
            <Button className="bg-[#f0b429] text-[#03080b] hover:bg-[#f0b429]/90"><Wand2 className="w-4 h-4 mr-1" /> Generate</Button>
            <Button variant="outline" className="border-[#1e293b] text-[#f1f5f9]"><Download className="w-4 h-4 mr-1" /> Download</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
