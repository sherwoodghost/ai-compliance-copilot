'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell, CheckCircle2, X, Activity, Shield,
  ClipboardList, Users, AlertTriangle, BookOpen,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore, AppNotification } from '@/lib/stores/notification.store';
import { notificationsApi } from '@/lib/api/auth';

// ─── Type icon map ────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  'raci.assigned':   Users,
  'task.assigned':   ClipboardList,
  'review.due':      BookOpen,
  'training.assigned': BookOpen,
  'control.failed':  AlertTriangle,
  'sod.violation':   Shield,
  'evidence.expiring': AlertTriangle,
};

const TYPE_COLOR: Record<string, string> = {
  'raci.assigned':   'text-brand-600',
  'task.assigned':   'text-brand-600',
  'review.due':      'text-amber-600',
  'training.assigned': 'text-brand-600',
  'control.failed':  'text-red-600',
  'sod.violation':   'text-red-600',
  'evidence.expiring': 'text-amber-600',
};

function getIcon(type: string): React.ElementType {
  return TYPE_ICON[type] ?? Activity;
}

function getIconColor(type: string): string {
  return TYPE_COLOR[type] ?? 'text-gray-500';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Individual notification item ────────────────────────────────────────────

function NotificationItem({
  n,
  onRead,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
}) {
  const Icon  = getIcon(n.type);
  const color = getIconColor(n.type);
  const isUnread = !n.readAt;

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer',
        isUnread && 'bg-brand-50/40',
      )}
      onClick={() => isUnread && onRead(n.id)}
    >
      <div className={cn('mt-0.5 shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs leading-snug', isUnread ? 'font-semibold text-gray-900' : 'text-gray-700')}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      {isUnread && (
        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1" />
      )}
    </div>
  );

  if (n.href) {
    return (
      <Link href={n.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, init, markRead, markAllRead } = useNotificationStore();

  // Seed from REST on mount
  useEffect(() => {
    notificationsApi.getMyNotifications(20)
      .then(({ notifications: ns, unreadCount: uc }) => {
        init(ns, uc);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [init]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleMarkRead(id: string) {
    markRead(id);
    await notificationsApi.markRead(id).catch(() => {});
  }

  async function handleMarkAllRead() {
    markAllRead();
    await notificationsApi.markAllRead().catch(() => {});
  }

  const visible = notifications.slice(0, 10);

  return (
    <div className="relative shrink-0" ref={panelRef}>
      {/* Bell button */}
      <button
        className="relative w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={`${unreadCount} unread notifications`}
      >
        <Bell className={cn('w-4 h-4', unreadCount > 0 ? 'text-brand-600' : 'text-gray-500')} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-900">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 font-medium"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-xs font-medium text-gray-600">You're all caught up</p>
                <p className="text-[11px] text-gray-400">No new notifications right now</p>
              </div>
            ) : (
              visible.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={handleMarkRead} />
              ))
            )}
          </div>

          {/* Footer */}
          {visible.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2 text-center">
              <p className="text-[10px] text-gray-400">
                Showing {visible.length} of {notifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
