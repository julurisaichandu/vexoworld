"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelMissionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function CancelMissionButton({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await cancelMissionAction(missionId);
          toast.success("Mission cancelled");
          router.refresh();
        })
      }
    >
      Cancel mission
    </Button>
  );
}
