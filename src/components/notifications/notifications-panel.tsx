"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Trash2 } from "lucide-react";

const LEVEL_STYLES = {
  info: "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30",
  warning: "bg-[#f0b429]/10 text-[#f0b429] border-[#f0b429]/30",
  error: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30",
  success: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30",
};

export function NotificationsPanel({
  notifications,
  onMarkRead,
  onClearAll,
}: {
  notifications: { id: string; level: "info" | "warning" | "error" | "success"; title: string; message: string; read: boolean; created_at: string }[];
  onMarkRead: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}) {
  const unread = notifications.filter((n) => !n.read);

  return (
    <Card className="h-full border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#f0b429]" /> Notifications
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30">{unread.length} unread</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-[#94a3b8] hover:text-[#ef4444]"
            onClick={onClearAll}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-20rem)] px-4">
          <div className="space-y-2 pb-4">
            {notifications.length === 0 && (
              <p className="text-xs text-[#94a3b8]">No notifications.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border bg-[#03080b] ${n.read ? "border-[#1e293b] opacity-60" : "border-[#1e293b]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={LEVEL_STYLES[n.level]}>{n.level}</Badge>
                    <span className="text-sm font-medium text-[#f1f5f9]">{n.title}</span>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-[#22c55e] hover:bg-[#22c55e]/10"
                      onClick={() => onMarkRead(n.id)}
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark read
                    </Button>
                  )}
                </div>
                <p className="text-xs text-[#94a3b8] mt-1">{n.message}</p>
                <p className="text-[10px] text-[#64748b] mt-2">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
