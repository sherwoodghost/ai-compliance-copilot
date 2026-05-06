'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api/compliance';
import { formatDate } from '@/lib/utils';
import { ClipboardList, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-danger-50 text-danger-700',
  high: 'bg-warning-50 text-warning-700',
  medium: 'bg-brand-50 text-brand-700',
  low: 'bg-gray-100 text-gray-600',
};

const COLUMNS = [
  { status: 'open', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

function TaskCard({ task, onMove }: { task: any; onMove: (status: string) => void }) {
  const overdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-medium text-gray-900 leading-snug">{task.title}</p>
        <span className={cn('shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full', PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low)}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2">
        {task.dueDate && (
          <span className={cn('text-xs', overdue ? 'text-danger-600 font-medium' : 'text-gray-400')}>
            {overdue && <AlertCircle className="w-3 h-3 inline mr-0.5" />}
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.assignedTo && (
          <span className="text-xs text-gray-400 ml-auto">{task.assignedTo.fullName}</span>
        )}
      </div>

      {/* Move buttons */}
      <div className="flex gap-1 pt-1 border-t border-gray-100">
        {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
          <button
            key={c.status}
            className="text-xs text-gray-400 hover:text-brand-600 transition-colors px-1"
            onClick={() => onMove(c.status)}
          >
            → {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => complianceApi.getTasks(),
  });

  const { data: myTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: complianceApi.getMyTasks,
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      complianceApi.updateTask(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const tasks: any[] = data ?? [];

  const byStatus = (status: string) => tasks.filter((t) => t.status === status);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1>Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.filter((t) => t.status !== 'done').length} open ·{' '}
            {tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length} overdue
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = byStatus(col.status);
            return (
              <div key={col.status} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMove={(status) => updateTask.mutate({ id: task.id, status })}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
                      <p className="text-xs text-gray-400">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
