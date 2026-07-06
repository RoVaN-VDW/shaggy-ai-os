"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Shield, File } from "lucide-react";

export default function UploadsPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-[#f1f5f9]">Upload Hub</h1>
        </div>
        <Button className="bg-[#00d4ff] text-[#020617] hover:bg-[#00d4ff]/90">
          <UploadCloud className="w-4 h-4 mr-1" /> Upload File
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 border-[#1e293b] bg-[#0a0f1e] min-h-[400px] flex items-center justify-center border-dashed border-2">
          <div className="text-center">
            <UploadCloud className="w-10 h-10 text-[#00d4ff] mx-auto mb-3" />
            <p className="text-sm text-[#94a3b8]">Drop files here or click to upload</p>
            <p className="text-xs text-[#64748b] mt-1">All files are scanned and labeled for sensitivity</p>
          </div>
        </Card>
        <Card className="border-[#1e293b] bg-[#0a0f1e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#22c55e]" /> Sensitivity Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["Public / Low Risk", "Internal / Medium Risk", "Confidential / High Risk", "Secret / Critical"].map((label) => (
              <div key={label} className="flex items-center gap-2 text-xs text-[#f1f5f9]">
                <File className="w-3 h-3 text-[#94a3b8]" /> {label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
