"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMissionAction } from "@/app/actions";

export function ConnectButton({ tag, className, compact }: { tag: string; className?: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      className={`${compact ? "h-7 gap-1 px-2.5 text-xs" : "h-9 gap-1.5 px-3.5"} rounded-full bg-ink text-cream hover:bg-forest ${className ?? ""}`}
      onClick={() =>
        start(async () => {
          try {
            const { missionId } = await createMissionAction(`Connect me with someone interested in ${tag}`);
            router.push(`/missions/${missionId}`);
          } catch {
            toast.error("Could not start the mission");
          }
        })
      }
    >
      <Sparkles /> {pending ? "Starting…" : compact ? "Connect" : "Ask my agent to connect"}
    </Button>
  );
}
