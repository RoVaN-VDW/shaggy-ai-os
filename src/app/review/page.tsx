"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, Check, X, AlertCircle } from "lucide-react";

const items = [
  { id: 1, title: "Deploy to production", requester: "SHAGGY", risk: "high", status: "pending" },
  { id: 2, title: "Send external email", requester: "Creative Agent", risk: "medium", status: "pending" },
  { id: 3, title: "Delete old logs", requester: "Maintenance", risk: "low", status: "approved" },
];

export default function ReviewPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-[#00d4ff]" />
        <h1 className="text-xl font-bold text-[#f1f5f9]">Review Queue</h1>
      </div>
      <Card className="flex-1 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">Pending Approvals</CardTitle></CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full px-4">
            <div className="space-y-2 pb-4">
              {items.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#f1f5f9]">{item.title}</span>
                      <Badge className={`text-[10px] ${item.risk === 'high' ? 'bg-[#ef4444]/10 text-[#ef4444]' : item.risk === 'medium' ? 'bg-[#f0b429]/10 text-[#f0b429]' : 'bg-[#22c55e]/10 text-[#22c55e]'}`}>{item.risk}</Badge>
                    </div>
                    <div className="text-[10px] text-[#94a3b8]">Requested by {item.requester} · {item.status}</div>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'pending' ? (
                      <>
                        <Button size="sm" className="h-7 bg-[#22c55e] text-white hover:bg-[#22c55e]/90"><Check className="w-3 h-3 mr-1" /> Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 border-[#1e293b] text-[#f1f5f9]"><X className="w-3 h-3 mr-1" /> Deny</Button>
                      </>
                    ) : (
                      <Badge className="bg-[#22c55e]/10 text-[#22c55e]">{item.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
        <AlertCircle className="w-3 h-3 text-[#f0b429]" />
        <span>Manual Mode is active. All external actions require approval.</span>
      </div>
    </div>
  );
}
