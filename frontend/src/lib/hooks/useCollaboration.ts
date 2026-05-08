'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

/**
 * useCollaboration
 *
 * Manages a Yjs document + Hocuspocus WebSocket provider for real-time
 * collaborative document editing. Requires:
 *   1. COLLABORATION_ENABLED=true on the backend
 *   2. Hocuspocus server running on the configured port
 *   3. Feature flag `documents.collaborativeEdit` enabled for the org
 *
 * Returns:
 *   - `ydoc`        — Yjs document (pass to TipTap Collaboration extension)
 *   - `connected`   — Whether the WebSocket is connected
 *   - `activeUsers` — Number of users currently connected to this document
 *   - `destroy`     — Call on unmount to clean up
 */

interface UseCollaborationOptions {
  documentId: string;
  userToken:  string;
  userName?:  string;
  userColor?: string;
  serverUrl?: string;
  enabled:    boolean;
}

interface CollaborationState {
  ydoc:        Y.Doc | null;
  connected:   boolean;
  activeUsers: number;
  destroy:     () => void;
}

export function useCollaboration(opts: UseCollaborationOptions): CollaborationState {
  const {
    documentId,
    userToken,
    userName  = 'Anonymous',
    userColor = '#6366f1',
    serverUrl = process.env['NEXT_PUBLIC_COLLABORATION_URL'] ?? 'ws://localhost:1234',
    enabled,
  } = opts;

  const ydocRef     = useRef<Y.Doc | null>(null);
  const providerRef = useRef<any>(null);
  const [connected,   setConnected]   = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    if (!enabled || !documentId || !userToken) {
      return;
    }

    // Create a new Yjs document for this session
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Dynamic import to avoid SSR issues
    let mounted = true;
    import('@hocuspocus/provider').then(({ HocuspocusProvider }) => {
      if (!mounted) {
        ydoc.destroy();
        return;
      }

      const provider = new HocuspocusProvider({
        url:      serverUrl,
        name:     'doc:' + documentId,
        token:    userToken,
        document: ydoc,

        onConnect: () => {
          if (mounted) setConnected(true);
        },

        onDisconnect: () => {
          if (mounted) setConnected(false);
        },

        onAwarenessUpdate: ({ states }: any) => {
          if (mounted) setActiveUsers(Array.isArray(states) ? states.length : 0);
        },
      });

      // Set local awareness (shows user's cursor to others)
      provider.setAwarenessField('user', {
        name:  userName,
        color: userColor,
      });

      providerRef.current = provider;
    }).catch((err) => {
      console.warn('Collaboration provider failed to initialize:', err);
    });

    return () => {
      mounted = false;
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
      setConnected(false);
      setActiveUsers(0);
    };
  // We only want to re-initialize when the document changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, enabled]);

  return {
    ydoc:        ydocRef.current,
    connected,
    activeUsers,
    destroy:     () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    },
  };
}
