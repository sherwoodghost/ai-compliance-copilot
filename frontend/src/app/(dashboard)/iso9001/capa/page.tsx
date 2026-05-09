'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Nonconformity {
  id: string;
  title: string;
  description: string;
  source: string;
  severity: string;
  status: string;
  detectedAt: string;
  containedAt?: string;
  closedAt?: string;
  rootCause?: string;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:          { label: 'Open',          color: 'bg-red-100 text-red-700' },
  investigating: { label: 'Investigating', color: 'bg-amber-100 text-amber-700' },
  contained:     { label: 'Contained',     color: 'bg-blue-100 text-blue-700' },
  pending_capa:  { label: 'Pending CAPA',  color: 'bg-purple-100 text-purple-700' },
  closed:        { label: 'Closed',        color: 'bg-green-100 text-green-700' },
};

const SEVERITY_COLORS: Record<string, string> = {
  major:       'bg-red-100 text-red-700',
  minor:       'bg-amber-100 text-amber-700',
  observation: 'bg-blue-100 text-blue-700',
  opportunity: 'bg-green-100 text-green-700',
};

function ageDays(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export default function CapaPage() {
  const qc = useQueryClient();
  const [selectedNcr, setSelectedNcr] = useState<Nonconformity | null>(null);
  const [rootCauseInput, setRootCauseInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const { data: ncrs = [], isLoading } = useQuery<Nonconformity[]>({
    queryKey: ['quality-ncrs-capa'],
    queryFn: () => apiClient.get('/quality/ncrs').then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.patch(`/quality/ncrs/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality-ncrs-capa'] });
      qc.invalidateQueries({ queryKey: ['quality-ncrs'] });
      setSelectedNcr(null);
      setRootCauseInput('');
      setNotesInput('');
    },
  });

  // CAPA-relevant NCRs: anything not just "open" (needs investigation first)
  const capaItems = ncrs.filter(n => n.status !== 'open');
  const pendingCapa = ncrs.filter(n => n.status === 'pending_capa');
  const investigating = ncrs.filter(n => n.status === 'investigating' || n.status === 'contained');
  const closedWithCapa = ncrs.filter(n => n.status === 'closed' && n.rootCause);

  // Recurrence rate: closed NCRs that share a root cause with another NCR
  const rootCauses = closedWithCapa.map(n => n.rootCause?.toLowerCase().trim()).filter(Boolean);
  const recurring = rootCauses.filter((rc, i) => rootCauses.indexOf(rc) !== i).length;
  const recurrenceRate = closedWithCapa.length > 0
    ? Math.round((recurring / closedWithCapa.length) * 100)
    : 0;

  // Avg closure time for closed NCRs
  const closedNcrs = ncrs.filter(n => n.status === 'closed' && n.closedAt);
  const avgDays = closedNcrs.length > 0
    ? Math.round(closedNcrs.reduce((sum, n) => {
        return sum + Math.floor((new Date(n.closedAt!).getTime() - new Date(n.detectedAt).getTime()) / 86400000);
      }, 0) / closedNcrs.length)
    : null;

  function openDetail(ncr: Nonconformity) {
    setSelectedNcr(ncr);
    setRootCauseInput(ncr.rootCause ?? '');
    setNotesInput(ncr.notes ?? '');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">CAPA Board</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 9001 Clause 10.2 — Corrective and preventive action tracking</p>
          </div>
        </div>
        <a href="/iso9001/ncr" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
          <Plus className="h-4 w-4" /> Log NCR
        </a>
      </div>

      {pendingCapa.length > 0 && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-purple-500 shrink-0" />
          <p className="text-sm text-purple-700 font-medium">
            {pendingCapa.length} NCR{pendingCapa.length !== 1 ? 's' : ''} awaiting corrective action — define root cause and action plan
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className={`text-2xl font-bold ${capaItems.length > 0 ? 'text-teal-600' : 'text-gray-900'}`}>{capaItems.length}</div>
          <div className="text-sm text-gray-500">Active CAPAs</div>
        </div>
        <div className={`border rounded-xl p-4 ${recurrenceRate > 20 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${recurrenceRate > 20 ? 'text-red-600' : 'text-gray-900'}`}>
            {closedWithCapa.length > 0 ? `${recurrenceRate}%` : '—'}
          </div>
          <div className={`text-sm ${recurrenceRate > 20 ? 'text-red-500' : 'text-gray-500'}`}>Recurrence Rate</div>
          {recurrenceRate > 20 && <div className="text-xs text-red-400 mt-0.5">Above 20% threshold</div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{avgDays !== null ? `${avgDays}d` : '—'}</div>
          <div className="text-sm text-gray-500">Avg. Closure Time</div>
        </div>
      </div>

      {/* CAPA Detail Modal */}
      {selectedNcr && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">CAPA Detail</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selectedNcr.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">{selectedNcr.description}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Root Cause Analysis *</label>
                <textarea
                  rows={3}
                  value={rootCauseInput}
                  onChange={e => setRootCauseInput(e.target.value)}
                  placeholder="Describe the underlying root cause..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Plan / Notes</label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  placeholder="Describe the corrective action plan..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedNcr(null)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  {selectedNcr.status !== 'closed' && (
                    <button
                      onClick={() => updateMutation.mutate({
                        id: selectedNcr.id,
                        data: {
                          rootCause: rootCauseInput || undefined,
                          notes: notesInput || undefined,
                          status: 'pending_capa',
                        },
                      })}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg disabled:opacity-50"
                    >
                      Save Root Cause
                    </button>
                  )}
                  {selectedNcr.status !== 'closed' && (
                    <button
                      onClick={() => updateMutation.mutate({
                        id: selectedNcr.id,
                        data: {
                          rootCause: rootCauseInput || undefined,
                          notes: notesInput || undefined,
                          status: 'closed',
                          closedAt: new Date().toISOString(),
                        },
                      })}
                      disabled={!rootCauseInput || updateMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-1"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Close CAPA
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : capaItems.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <ClipboardCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No active CAPAs</p>
          <p className="text-sm text-gray-400 mt-1">CAPAs appear when NCRs move past the "Open" stage</p>
          <a href="/iso9001/ncr" className="inline-flex items-center gap-1 mt-4 text-sm text-teal-600 hover:text-teal-700 font-medium">
            View NCR Tracker →
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending CAPA section */}
          {pendingCapa.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pending CAPA ({pendingCapa.length})
              </h2>
              <div className="space-y-3">
                {pendingCapa.map(n => (
                  <NcrCapaRow key={n.id} ncr={n} onOpen={openDetail} onUpdate={(data) =>
                    updateMutation.mutate({ id: n.id, data })
                  } />
                ))}
              </div>
            </div>
          )}

          {/* Investigating / Contained */}
          {investigating.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Under Investigation ({investigating.length})
              </h2>
              <div className="space-y-3">
                {investigating.map(n => (
                  <NcrCapaRow key={n.id} ncr={n} onOpen={openDetail} onUpdate={(data) =>
                    updateMutation.mutate({ id: n.id, data })
                  } />
                ))}
              </div>
            </div>
          )}

          {/* Closed CAPAs */}
          {closedWithCapa.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Closed ({closedWithCapa.length})
              </h2>
              <div className="space-y-3">
                {closedWithCapa.slice(0, 5).map(n => (
                  <NcrCapaRow key={n.id} ncr={n} onOpen={openDetail} onUpdate={(data) =>
                    updateMutation.mutate({ id: n.id, data })
                  } />
                ))}
                {closedWithCapa.length > 5 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    +{closedWithCapa.length - 5} more closed CAPAs
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NcrCapaRow({ ncr, onOpen, onUpdate }: {
  ncr: Nonconformity;
  onOpen: (ncr: Nonconformity) => void;
  onUpdate: (data: any) => void;
}) {
  const age = ageDays(ncr.detectedAt);
  const isOpen = ncr.status !== 'closed';
  const cfg = STATUS_CONFIG[ncr.status] ?? { label: ncr.status, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className={`bg-white border rounded-xl p-5 ${isOpen && age > 60 ? 'border-red-300' : isOpen && age > 30 ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900">{ncr.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[ncr.severity] ?? 'bg-gray-100 text-gray-700'}`}>
              {ncr.severity.toUpperCase()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            <span className={`text-xs ${age > 30 ? 'text-amber-600' : 'text-gray-400'}`}>{age}d old</span>
          </div>
          <p className="text-sm text-gray-600 mb-1">{ncr.description}</p>
          {ncr.rootCause && (
            <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
              <RefreshCw className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
              Root cause: {ncr.rootCause}
            </p>
          )}
        </div>
        {isOpen && (
          <div className="flex gap-2 shrink-0 flex-col items-end">
            <button
              onClick={() => onOpen(ncr)}
              className="px-3 py-1 text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-lg"
            >
              {ncr.rootCause ? 'Edit CAPA' : 'Define CAPA'}
            </button>
            {ncr.rootCause && (
              <button
                onClick={() => onUpdate({ status: 'closed', closedAt: new Date().toISOString() })}
                className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" /> Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
