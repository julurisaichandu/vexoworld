"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  return (
    <Button
      variant="outline"
      className="rounded-full border-ink/15 bg-card hover:bg-cream-2"
      size="sm"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"))}
    >
      <Copy /> Copy
    </Button>
  );
}
