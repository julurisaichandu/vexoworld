"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pause, Play, Settings, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { revokeAllSharingAction, updateAgentAction } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ActivityControls({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const run = (fn: () => Promise<void>, msg: string) =>
    start(async () => {
      await fn();
      toast.success(msg);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="rounded-full border-ink/15 bg-card hover:bg-cream-2" disabled={pending} onClick={() => run(() => updateAgentAction({ paused: !paused }), paused ? "Agent resumed" : "Agent paused")}>
        {paused ? <Play /> : <Pause />} {paused ? "Resume agent" : "Pause agent"}
      </Button>
      <Button variant="outline" className="rounded-full border-ink/15 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm(true)}>
        <ShieldOff /> Revoke sharing
      </Button>
      <Link href="/settings" className={`${buttonVariants({ variant: "ghost" })} rounded-full`}>
        <Settings /> Settings
      </Link>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke all sharing?</DialogTitle>
            <DialogDescription>
              Your agent stops sharing name, interests, goals, location and availability, and auto-publishing turns off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Keep sharing</Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirm(false);
                run(revokeAllSharingAction, "All sharing revoked");
              }}
            >
              Revoke everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
