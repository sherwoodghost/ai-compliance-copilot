'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { getSocket } from '@/lib/ws/socket';
import { useNotificationStore } from '@/lib/stores/notification.store';

export function useComplianceSocket() {
  const qc  = useQueryClient();
  const add = useNotificationStore((s) => s.add);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;

    const socket = getSocket();

    socket.on('compliance:score:updated', () => {
      qc.invalidateQueries({ queryKey: ['org-stats'] });
    });

    socket.on('agent:run:updated', () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['system-stats'] });
    });

    socket.on('workflow:updated', () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['org-stats'] });
    });

    socket.on('task:created', () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    });

    socket.on('journey:stage:updated', () => {
      qc.invalidateQueries({ queryKey: ['journeys'] });
    });

    socket.on('checkpoint:created', () => {
      qc.invalidateQueries({ queryKey: ['journeys'] });
    });

    socket.on('checkpoint:resolved', () => {
      qc.invalidateQueries({ queryKey: ['journeys'] });
    });

    // ── Personal notification event ──────────────────────────────────────────
    socket.on('notification', (data: any) => {
      add(data);
    });

    return () => {
      socket.off('compliance:score:updated');
      socket.off('agent:run:updated');
      socket.off('workflow:updated');
      socket.off('task:created');
      socket.off('journey:stage:updated');
      socket.off('checkpoint:created');
      socket.off('checkpoint:resolved');
      socket.off('notification');
    };
  }, [qc, add]);
}
