import { Logger } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const logger = new Logger('CollaborationServer');

/**
 * CollaborationServer
 *
 * Runs a Hocuspocus WebSocket server alongside NestJS for real-time
 * collaborative document editing via Yjs.
 *
 * Document rooms are keyed by `doc:{documentId}`.
 *
 * Authentication:
 *  - Client passes JWT as the `token` connection parameter
 *  - Server validates the JWT using the same secret as NestJS
 *
 * Persistence:
 *  - On `onLoadDocument`: load Yjs state from the DB if present
 *  - On `onChange` (debounced 3s): save Yjs state to DB
 *
 * Feature flag:
 *  - Only started if `COLLABORATION_ENABLED=true` env var is set
 */

interface CollabOptions {
  port:       number;
  jwtSecret:  string;
  prisma:     PrismaClient;
}

export async function startCollaborationServer(opts: CollabOptions): Promise<Server | null> {
  const { port, jwtSecret, prisma } = opts;

  if (process.env['COLLABORATION_ENABLED'] !== 'true') {
    logger.log('Collaboration server disabled (set COLLABORATION_ENABLED=true to enable)');
    return null;
  }

  // Debounce map: documentId -> timeout
  const saveTimers = new Map<string, NodeJS.Timeout>();

  const server = new Server({
    port,

    // ── Authentication ────────────────────────────────────────────────────────

    async onAuthenticate(data: any) {
      const token = data.token;
      if (!token) throw new Error('Unauthenticated: no token');

      try {
        jwt.verify(token, jwtSecret) as any;
      } catch {
        throw new Error('Unauthenticated: invalid token');
      }
    },

    // ── Load document from DB ─────────────────────────────────────────────────

    async onLoadDocument(data: any) {
      const docId = extractDocumentId(data.documentName);
      if (!docId) return;

      try {
        const doc = await (prisma as any).document.findFirst({
          where:  { id: docId, deletedAt: null },
          select: { yjsState: true },
        });

        if (doc?.yjsState) {
          const state = Buffer.from(doc.yjsState as string, 'base64');
          Y.applyUpdate(data.document, state);
        }
      } catch (err) {
        logger.warn(`Failed to load collab state for doc ${docId}: ${(err as Error).message}`);
      }
    },

    // ── Persist changes (debounced 3s) ─────────────────────────────────────────

    async onChange(data: any) {
      const docId = extractDocumentId(data.documentName);
      if (!docId) return;

      const existing = saveTimers.get(docId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        saveTimers.delete(docId);
        try {
          const state  = Y.encodeStateAsUpdate(data.document);
          const base64 = Buffer.from(state).toString('base64');

          await (prisma as any).document.updateMany({
            where: { id: docId, deletedAt: null, lockedAt: null },
            data:  { yjsState: base64, updatedAt: new Date() },
          });
        } catch (err) {
          logger.warn(`Failed to persist collab state for doc ${docId}: ${(err as Error).message}`);
        }
      }, 3000);

      saveTimers.set(docId, timer);
    },

    // ── Logging ───────────────────────────────────────────────────────────────

    async onConnect(data: any) {
      const docId = extractDocumentId(data.documentName);
      logger.debug(`Collab connect: doc=${docId}`);
    },

    async onDisconnect(data: any) {
      const docId = extractDocumentId(data.documentName);
      logger.debug(`Collab disconnect: doc=${docId}`);
    },
  });

  await server.listen();
  logger.log(`Collaboration server (Hocuspocus) listening on port ${port}`);
  return server;
}

/** Extract document ID from room name `doc:{documentId}` */
function extractDocumentId(roomName: string): string | null {
  if (roomName?.startsWith('doc:')) return roomName.slice(4);
  return null;
}
