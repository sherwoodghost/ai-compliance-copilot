'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { getSocket } from '@/lib/ws/socket';

export function useComplianceSocket() {
  const qc = useQueryClient();

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
      // Could also trigger a browser notification here
    });

    socket.on('checkpoint:resolved', () => {
      qc.invalidateQueries({ queryKey: ['journeys'] });
    });

    // Ingestion events
    socket.on('ingestion:batch:progress', () => {
      qc.invalidateQueries({ queryKey: ['ingestion-batches'] });
    });

    socket.on('ingestion:file:classified', (data: { batchId: string }) => {
      qc.invalidateQueries({ queryKey: ['ingestion-batches'] });
      qc.invalidateQueries({ queryKey: ['ingestion-files', data.batchId] });
    });

    socket.on('ingestion:batch:completed', (data: { batchId: string }) => {
      qc.invalidateQueries({ queryKey: ['ingestion-batches'] });
      qc.invalidateQueries({ queryKey: ['ingestion-files', data.batchId] });
    });

    socket.on('ingestion:file:converted', () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    });

    return () => {
      socket.off('compliance:score:updated');
      socket.off('agent:run:updated');
      socket.off('workflow:updated');
      socket.off('task:created');
      socket.off('journey:stage:updated');
      socket.off('checkpoint:created');
      socket.off('checkpoint:resolved');
      socket.off('ingestion:batch:progress');
      socket.off('ingestion:file:classified');
      socket.off('ingestion:batch:completed');
      socket.off('ingestion:file:converted');
    };
  }, [qc]);
}
