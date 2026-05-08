import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface NotificationPayload {
  type:      string;   // e.g. 'task.assigned' | 'raci.assigned' | 'review.due'
  title:     string;
  body?:     string;
  href?:     string;   // deep link
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Unified notification delivery service.
 *
 * Persists a NotificationLog record for every notification, then emits a
 * WebSocket event to the user's personal socket room (`user:{userId}`).
 * The WebSocket gateway dependency is injected lazily (optional) to avoid
 * circular dependency issues — if the gateway isn't ready the notification is
 * still persisted so the REST polling path picks it up.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  // Gateway injected lazily via setGateway() to avoid circular DI
  private gateway: { emitNotification: (userId: string, payload: object) => void } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Called by GatewaysModule after both services are constructed. */
  setGateway(gw: { emitNotification: (userId: string, payload: object) => void }) {
    this.gateway = gw;
  }

  // ─── Send to a specific user ───────────────────────────────────────────────

  async send(orgId: string, userId: string, payload: NotificationPayload): Promise<void> {
    try {
      const record = await this.prisma.notificationLog.create({
        data: {
          orgId,
          userId,
          type:     payload.type,
          title:    payload.title,
          body:     payload.body,
          href:     payload.href,
          priority: payload.priority ?? 'normal',
        },
      });

      // Push to connected client (fire-and-forget — persistence is the source of truth)
      this.gateway?.emitNotification(userId, {
        id:        record.id,
        type:      record.type,
        title:     record.title,
        body:      record.body,
        href:      record.href,
        priority:  record.priority,
        readAt:    record.readAt,
        createdAt: record.createdAt,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send notification to ${userId}: ${err.message}`);
      // Never throw — notification failures must not break the main flow
    }
  }

  // ─── Send to all users with a given compliance role ───────────────────────

  async sendToRole(
    orgId: string,
    role: string,
    payload: NotificationPayload,
  ): Promise<void> {
    try {
      const users = await this.prisma.complianceResponsibility.findMany({
        where: { orgId, role: role as any },
        select: { userId: true },
      });

      await Promise.all(
        users.map((u) => this.send(orgId, u.userId, payload)),
      );
    } catch (err: any) {
      this.logger.error(`sendToRole failed for ${role}: ${err.message}`);
    }
  }

  // ─── REST helpers (used by the notifications controller) ──────────────────

  async getForUser(userId: string, limit = 20) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notificationLog.count({
        where: { userId, readAt: null },
      }),
    ]);
    return { notifications, unreadCount };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notificationLog.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notificationLog.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
