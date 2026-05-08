import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus   = 'open' | 'in_progress' | 'blocked' | 'done' | 'accepted';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskKind =
  | 'EVIDENCE_UPLOAD'
  | 'POLICY_AUTHORING'
  | 'ACCESS_REVIEW'
  | 'TRAINING'
  | 'RISK_ASSESSMENT'
  | 'VENDOR_REVIEW'
  | 'INCIDENT_DRILL'
  | 'ATTESTATION'
  | 'CONFIGURATION'
  | 'APPROVAL';

export interface TaskGuidance {
  why:                string;
  evidenceHint:       string;
  fileFormat?:        string;
  stepByStep:         string[];
  exampleDescription: string;
  estimatedMinutes:   number;
  controlCategory?:   string;
  templateId?:        string;
}

export interface Task {
  id:          string;
  title:       string;
  description?: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  kind?:       TaskKind | null;
  isGuided?:   boolean;
  guidance?:   TaskGuidance | null;
  dueDate?:    string | null;
  assignedTo?: string | null;
  dependsOn?:  string[];
  recurrence?: { frequency: string; nextDueAt: string; cadenceReason: string } | null;
  estimatedMinutes?: number | null;
  control?:    { id: string; code: string; title: string } | null;
  assignee?:   { id: string; fullName: string; email: string } | null;
  source?:     string | null;
  orgId:       string;
  createdAt:   string;
  updatedAt:   string;
}

export interface SprintItem {
  rank:             number;
  taskId:           string;
  title:            string;
  priority:         TaskPriority;
  status:           TaskStatus;
  controlCode:      string | null;
  controlCategory:  string | null;
  assignee:         string | null;
  dueDate?:         string;
  urgencyLevel:     'overdue' | 'critical' | 'high' | 'medium';
  reason:           string;
  estimatedHours:   number;
}

export interface SprintPlan {
  weekOf:        string;
  readinessScore: number;
  weekFocus:     string;
  sprintItems:   SprintItem[];
  totalOpen:     number;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateTaskDto {
  title:        string;
  description?: string;
  priority:     TaskPriority;
  dueDate?:     string;
  assignedTo?:  string;
  controlId?:   string;
}

export interface UpdateTaskDto {
  status?:      TaskStatus;
  priority?:    TaskPriority;
  title?:       string;
  description?: string;
  dueDate?:     string | null;
  assignedTo?:  string | null;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const tasksApi = {
  /** List all tasks for the org */
  list(): Promise<Task[]> {
    return apiClient.get<Task[]>('/tasks').then((r) => r.data);
  },

  /** Get a single task by ID */
  get(id: string): Promise<Task> {
    return apiClient.get<Task>(`/tasks/${id}`).then((r) => r.data);
  },

  /** Create a new task */
  create(dto: CreateTaskDto): Promise<Task> {
    return apiClient.post<Task>('/tasks', dto).then((r) => r.data);
  },

  /** Update a task (status, priority, assignee, etc.) */
  update(id: string, dto: UpdateTaskDto): Promise<Task> {
    return apiClient.patch<Task>(`/tasks/${id}`, dto).then((r) => r.data);
  },

  /** AI-generate tasks from unaddressed control gaps */
  generateFromGaps(): Promise<{ created: number; tasks: Task[] }> {
    return apiClient
      .post<{ created: number; tasks: Task[] }>('/tasks/generate-from-gaps', {})
      .then((r) => r.data);
  },

  /** AI sprint planner: rank and schedule tasks for the current week */
  sprintPlan(): Promise<SprintPlan> {
    return apiClient
      .post<SprintPlan>('/tasks/ai-sprint-planner', {})
      .then((r) => r.data);
  },
};
