"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Shield, Key, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#00d4ff]" />
        <h1 className="text-xl font-bold text-[#f1f5f9]">Settings</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2"><Shield className="w-4 h-4 text-[#22c55e]" /> Safety</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#f1f5f9]">Manual Mode</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#f1f5f9]">Require approval for all external actions</Label>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2"><Bell className="w-4 h-4 text-[#f0b429]" /> Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#f1f5f9]">Budget alerts</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#f1f5f9]">Review queue push</Label>
              <Switch />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2"><Key className="w-4 h-4 text-[#00d4ff]" /> API Keys</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs text-[#94a3b8]">Supabase URL</Label><Input value="aormdmjtzwnvayjvhhgt" disabled className="border-[#1e293b] bg-[#03080b] text-[#f1f5f9]" /></div>
            <div><Label className="text-xs text-[#94a3b8]">OpenAI / Codex</Label><Input type="password" value="••••••••" className="border-[#1e293b] bg-[#03080b] text-[#f1f5f9]" /></div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-auto flex justify-end">
        <Button className="bg-[#00d4ff] text-[#03080b] hover:bg-[#00d4ff]/90">Save Changes</Button>
      </div>
    </div>
  );
}
