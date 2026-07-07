"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ModelProvider } from "@/hooks/useCockpitData";
import { Settings2, HeartPulse, Loader2, Clock } from "lucide-react";

type Props = {
  provider: ModelProvider;
  onStatusChange: (id: string, status: string) => void;
};

function formatLastSeen(value: string | null | undefined) {
  if (!value) return "never";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function healthColorClass(health: string | undefined) {
  if (health === "healthy") return "border-[#22c55e]/30 text-[#22c55e]";
  if (health === "unhealthy") return "border-[#ef4444]/30 text-[#ef4444]";
  if (health && (health.startsWith("error") || health === "missing_key")) return "border-[#f0b429]/30 text-[#f0b429]";
  return "border-[#94a3b8]/30 text-[#94a3b8]";
}

export function ProviderConfigDialog({ provider, onStatusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(provider.status);
  const [budget, setBudget] = useState(100);
  const [alerts, setAlerts] = useState(true);
  const [checking, setChecking] = useState(false);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState(provider.last_seen_at);
  const [healthStatus, setHealthStatus] = useState(provider.health_status);

  const handleSave = () => {
    onStatusChange(provider.id, status);
    setOpen(false);
  };

  const handleCheckHealth = async () => {
    setChecking(true);
    setHealthMessage(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok && data.providers) {
        const match = data.providers.find((p: { id: string; health: string; last_seen_at?: string }) => p.id === provider.id);
        if (match) {
          setHealthStatus(match.health);
          setLastSeen(match.last_seen_at ?? new Date().toISOString());
          setHealthMessage(`Health: ${match.health}`);
        } else {
          setHealthMessage("Provider not checked.");
        }
      } else {
        setHealthMessage(data.error || "Health check failed.");
      }
    } catch (err) {
      setHealthMessage(err instanceof Error ? err.message : "Health check failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-[#94a3b8] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10">
            <Settings2 className="w-3 h-3 mr-1" /> Configure
          </Button>
        }
      />
      <DialogContent className="bg-[#0b0f17] border-[#1e293b] text-[#f1f5f9] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#f1f5f9] flex items-center gap-2">
            {provider.provider}
            <Badge
              variant="outline"
              className={
                status === "active"
                  ? "border-[#22c55e]/30 text-[#22c55e]"
                  : "border-[#94a3b8]/30 text-[#94a3b8]"
              }
            >
              {status}
            </Badge>
            <Badge variant="outline" className={healthColorClass(healthStatus)}>
              {healthStatus || "unknown"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Model</Label>
            <Input
              value={provider.model}
              readOnly
              className="bg-[#03080b] border-[#1e293b] text-[#f1f5f9] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">Status</Label>
            <Select value={status} onValueChange={(value: string | null) => { if (value) setStatus(value); }}>
              <SelectTrigger className="bg-[#03080b] border-[#1e293b] text-[#f1f5f9]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0f17] border-[#1e293b]">
                <SelectItem value="active" className="text-[#f1f5f9]">Active</SelectItem>
                <SelectItem value="placeholder" className="text-[#f1f5f9]">Placeholder</SelectItem>
                <SelectItem value="disabled" className="text-[#f1f5f9]">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-lg bg-[#03080b] border border-[#1e293b] p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs text-[#94a3b8]">Health Status</div>
                <div className="text-sm font-medium text-[#f1f5f9]">{healthStatus || "unknown"}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckHealth}
                disabled={checking}
                className="h-8 text-[10px] border-[#1e293b] text-[#94a3b8] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10"
              >
                {checking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <HeartPulse className="w-3 h-3 mr-1" />}
                Check Health
              </Button>
            </div>
            {lastSeen && (
              <div className="text-[10px] text-[#64748b] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last seen {formatLastSeen(lastSeen)}
              </div>
            )}
            {healthMessage && (
              <div className="text-[10px] text-[#94a3b8]">{healthMessage}</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-[#94a3b8]">
              <Label>Monthly Budget Limit</Label>
              <span className="text-[#00d4ff]">${budget}</span>
            </div>
            <Slider
              value={[budget]}
              min={10}
              max={1000}
              step={10}
              onValueChange={(value: number | readonly number[]) => {
                const v = Array.isArray(value) ? value[0] : value;
                if (typeof v === "number") setBudget(v);
              }}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-[#94a3b8]">Low-budget alerts</Label>
            <Switch checked={alerts} onCheckedChange={setAlerts} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-[#94a3b8]">API Key</Label>
            <Input
              type="password"
              value="••••••••••••••••••••••"
              readOnly
              className="bg-[#03080b] border-[#1e293b] text-[#f1f5f9] text-sm font-mono"
            />
            <p className="text-[10px] text-[#64748b]">
              API keys are managed locally via the terminal. This field is a placeholder.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-[#1e293b] text-[#94a3b8] hover:text-[#f1f5f9]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-[#00d4ff] text-[#0b0f17] hover:bg-[#00d4ff]/90"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
