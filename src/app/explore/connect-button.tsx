"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMissionAction } from "@/app/actions";

export function ConnectButton({ tag, className }: { tag: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      className={`h-9 gap-1.5 rounded-full bg-ink px-3.5 text-cream hover:bg-forest ${className ?? ""}`}
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
      <Sparkles /> {pending ? "Starting…" : "Ask my agent to connect"}
    </Button>
  );
}
