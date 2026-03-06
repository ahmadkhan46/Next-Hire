"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellDot } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/notifications`, { signal });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (error instanceof TypeError) {
        // Transient network failures (dev server restarts, offline) should not spam console.
        return;
      }
      console.error("Failed to fetch notifications:", error);
    } finally {
      setInitialLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchNotifications(controller.signal);

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000); // Poll every 30s

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/orgs/${orgId}/notifications/${notificationId}/read`, {
        method: "POST",
      });
      await fetchNotifications();
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch(`/api/orgs/${orgId}/notifications/read-all`, {
        method: "POST",
      });
      await fetchNotifications();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }

    setOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const diffMs = Date.now() - created;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "Just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(createdAt));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-2xl border border-slate-300/80 bg-white/80 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)] hover:bg-white"
          aria-label="Open notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[370px] rounded-2xl border border-slate-200/90 bg-white/95 p-0 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <BellDot className="h-4 w-4 text-slate-600" />
            <span className="font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {unreadCount} new
              </Badge>
            ) : null}
          </div>

          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="h-8 rounded-xl px-2 text-xs"
            >
              {loading ? "Marking..." : "Mark all read"}
            </Button>
          ) : null}
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {initialLoading ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : (
            <>
              {notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        notif.read
                          ? "border-slate-200 bg-white hover:bg-slate-50"
                          : "border-blue-200/80 bg-blue-50/60 hover:bg-blue-50"
                      }`}
                      onClick={() => void handleNotificationClick(notif)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {!notif.read ? (
                              <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            ) : null}
                            <p className="truncate text-sm font-medium text-slate-900">
                              {notif.title}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {notif.message}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {formatNotificationTime(notif.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
