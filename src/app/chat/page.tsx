"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase/client";
import { Send, MessageSquare } from "lucide-react";

export default function ChatPage() {
  const [providers, setProviders] = useState<{ provider: string; model: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    supabase.from("model_providers").select("provider, model").then(({ data }) => {
      if (data) {
        setProviders(data);
        setSelected(data[0]?.provider || "");
      }
    });
  }, []);

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", content: input }]);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", content: `This is a manual-mode placeholder response from ${selected}.` }]);
    }, 500);
    setInput("");
  };

  return (
    <div className="h-full flex gap-4">
      <div className="w-64 flex flex-col gap-3">
        <Card className="border-[#1e293b] bg-[#0a0f1e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8]">Model</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selected} onValueChange={(value) => setSelected(value ?? "")}>
              <SelectTrigger className="border-[#1e293b] bg-[#050505] text-[#f1f5f9]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#1e293b] bg-[#0a0f1e]">
                {providers.map((p) => (
                  <SelectItem key={p.provider} value={p.provider} className="text-[#f1f5f9]">
                    {p.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="border-[#1e293b] bg-[#0a0f1e] flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8]">Chats</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#94a3b8]">No saved chats.</p>
          </CardContent>
        </Card>
      </div>
      <Card className="flex-1 flex flex-col border-[#1e293b] bg-[#0a0f1e]">
        <CardHeader className="border-b border-[#1e293b] pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#f1f5f9] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#00d4ff]" />
              Chat Studio
            </CardTitle>
            <Badge className="bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/30">Manual</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-[#94a3b8]">Start a conversation. All actions are manual.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-[#00d4ff] text-[#020617]" : "bg-[#111827] text-[#f1f5f9] border border-[#1e293b]"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-[#1e293b] flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message..."
              className="flex-1 border-[#1e293b] bg-[#050505] text-[#f1f5f9]"
            />
            <Button onClick={send} className="bg-[#00d4ff] text-[#020617] hover:bg-[#00d4ff]/90">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
