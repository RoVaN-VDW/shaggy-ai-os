"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rocket, Loader2, Send } from "lucide-react";

export function QuickActionsDialog({
  providers,
  projects,
}: {
  providers: { id: string; provider: string; model: string; status: string }[];
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const activeProviders = providers.filter((p) => p.status === "active");

  const handleSend = async () => {
    if (!providerId || !prompt.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, projectId: projectId || null, prompt }),
      });
      const data = await res.json();
      setResult(data.ok ? data.output : `Error: ${data.error || "Unknown error"}`);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "Failed to dispatch"}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button className="w-full bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20 border border-[#00d4ff]/30">
          <Rocket className="w-4 h-4 mr-2" /> New dispatch
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0c111e] border-[#1e293b] text-[#f1f5f9] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#00d4ff]" /> Dispatch to Model
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#94a3b8]">Provider</Label>
              <SelectPrimitive
                value={providerId}
                onChange={(v: string) => setProviderId(v)}
                options={activeProviders.length === 0 ? [{ value: "", label: "No active providers", disabled: true }] : activeProviders.map((p) => ({ value: p.id, label: `${p.provider} (${p.model})` }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#94a3b8]">Project (optional)</Label>
              <SelectPrimitive
                value={projectId}
                onChange={(v: string) => setProjectId(v)}
                options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the task you want the model to execute..."
              className="bg-[#03080b] border-[#1e293b] text-[#f1f5f9] min-h-[120px]"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!providerId || !prompt.trim() || sending}
            className="w-full bg-[#00d4ff] text-[#0a0f1e] hover:bg-[#00d4ff]/90"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send dispatch
          </Button>

          {result && (
            <div className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] text-sm text-[#f1f5f9] max-h-60 overflow-auto whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectPrimitive({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <Select value={value || undefined} onValueChange={(v: string | null) => onChange(v || "")}>
      <SelectTrigger className="bg-[#03080b] border-[#1e293b] text-[#f1f5f9] w-full">
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent className="bg-[#0c111e] border-[#1e293b]">
        {options.map((opt) => (
          <SelectItem key={opt.value || "empty"} value={opt.value || "empty"} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
