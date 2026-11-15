"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createMissionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ConnectButton({ goal }: { goal: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      className="bg-indigo-600 text-white hover:bg-indigo-700"
      onClick={() =>
        start(async () => {
          try {
            const { missionId } = await createMissionAction(goal);
            router.push(`/missions/${missionId}`);
          } catch {
            toast.error("Could not start the mission.");
          }
        })
      }
    >
      Ask my agent to connect
    </Button>
  );
}
