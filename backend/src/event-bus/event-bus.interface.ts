export interface AgentJobPayload {
  orgId: string;
  workflowId: string;
  journeyId: string;
  runId?: string;
  businessProfile: Record<string, unknown>;
  inputPayload: Record<string, unknown>;
  isReplay?: boolean;
  replayFromStepIndex?: number;
}

export interface EventBusPublishOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
}

export interface IEventBus {
  /**
   * Publish a job to a named queue/topic.
   * Queue name maps to agent name (e.g. 'agent.planner').
   */
  publish(queue: string, payload: AgentJobPayload, opts?: EventBusPublishOptions): Promise<void>;

  /**
   * Emit a lightweight event (no queue, just pub/sub).
   * Used for real-time WebSocket updates — not for agent orchestration.
   */
  emit(event: string, payload: Record<string, unknown>): Promise<void>;
}

export const EVENT_BUS = Symbol('IEventBus');
