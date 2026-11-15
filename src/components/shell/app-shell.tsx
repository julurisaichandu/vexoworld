import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { getDemoUsers, getNotifications, getViewer } from "@/lib/queries";
import { AgentAvatar } from "@/components/agent-avatar";
import { Logo } from "./logo";
import { SidebarNav, MobileTabs } from "./nav";
import { UserMenu } from "./user-menu";
import { NotificationsBell } from "./notifications-bell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const uid = await currentUserId();
  if (!uid) return children;
  const viewer = await getViewer(uid).catch(() => null);
  if (!viewer?.agent) return children;
  const [users, notifications] = await Promise.all([getDemoUsers(), getNotifications(uid)]);
  const { user, agent, pending } = viewer;
  const menuProps = { user: { id: user.id, name: user.name }, agent, users };

  return (
    <div className="min-h-dvh md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-cream md:flex">
        <Link href="/" className="px-6 pt-7 pb-6">
          <Logo tone="light" />
        </Link>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav pending={pending} />
        </div>
        <div className="border-t border-white/10 p-3"><UserMenu {...menuProps} tone="dark" /></div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationsBell items={notifications} />
          <Link href="/settings" aria-label="Agent settings">
            <AgentAvatar agent={agent} size="sm" />
          </Link>
        </div>
      </header>

      <div className="fixed top-5 right-8 z-30 hidden md:block">
        <NotificationsBell items={notifications} />
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-12">{children}</main>
      <MobileTabs pending={pending} menu={<UserMenu {...menuProps} tone="light" />} />
    </div>
  );
}
