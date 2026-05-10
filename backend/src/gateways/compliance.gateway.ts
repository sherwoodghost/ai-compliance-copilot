import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface ClientInfo {
  userId: string;
  orgId: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/compliance',
})
export class ComplianceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ComplianceGateway.name);
  private readonly clients = new Map<string, ClientInfo>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ?? client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      this.clients.set(client.id, {
        userId: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
      });

      // Join org-scoped room for targeted broadcasts
      client.join(`org:${payload.orgId}`);
      this.logger.log(`Client connected: ${client.id} | org: ${payload.orgId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Broadcast events ──────────────────────────────────────────────────────

  emitAgentRunUpdate(orgId: string, runId: string, status: string, agentName: string) {
    this.server.to(`org:${orgId}`).emit('agent:run:updated', {
      runId, status, agentName, timestamp: new Date().toISOString(),
    });
  }

  emitWorkflowUpdate(orgId: string, workflowId: string, status: string) {
    this.server.to(`org:${orgId}`).emit('workflow:updated', {
      workflowId, status, timestamp: new Date().toISOString(),
    });
  }

  emitOnboardingMessage(orgId: string, message: string, isComplete: boolean, extractedFields: Record<string, unknown>) {
    this.server.to(`org:${orgId}`).emit('onboarding:message', {
      message, isComplete, extractedFields, timestamp: new Date().toISOString(),
    });
  }

  emitComplianceScoreUpdate(orgId: string, score: number, controlsUpdated: number) {
    this.server.to(`org:${orgId}`).emit('compliance:score:updated', {
      score, controlsUpdated, timestamp: new Date().toISOString(),
    });
  }

  emitTaskCreated(orgId: string, taskId: string, title: string, priority: string) {
    this.server.to(`org:${orgId}`).emit('task:created', {
      taskId, title, priority, timestamp: new Date().toISOString(),
    });
  }

  emitJourneyUpdate(orgId: string, journeyId: string, stage: string, agentName: string) {
    this.server.to(`org:${orgId}`).emit('journey:stage:updated', {
      journeyId, stage, agentName, timestamp: new Date().toISOString(),
    });
  }

  emitCheckpointCreated(orgId: string, checkpointId: string, checkpointType: string, agentName: string) {
    this.server.to(`org:${orgId}`).emit('checkpoint:created', {
      checkpointId, checkpointType, agentName, timestamp: new Date().toISOString(),
    });
  }

  emitCheckpointResolved(orgId: string, checkpointId: string, decision: string) {
    this.server.to(`org:${orgId}`).emit('checkpoint:resolved', {
      checkpointId, decision, timestamp: new Date().toISOString(),
    });
  }

  // ─── Ingestion events ──────────────────────────────────────────────────────

  emitIngestionBatchProgress(
    orgId: string, batchId: string, progress: number,
    processedFiles: number, totalFiles: number,
  ) {
    this.server.to(`org:${orgId}`).emit('ingestion:batch:progress', {
      batchId, progress, processedFiles, totalFiles,
      timestamp: new Date().toISOString(),
    });
  }

  emitIngestionFileClassified(
    orgId: string, fileId: string, batchId: string,
    status: string, detectedType: string | null, confidence: number | null, tier: number,
  ) {
    this.server.to(`org:${orgId}`).emit('ingestion:file:classified', {
      fileId, batchId, status, detectedType, confidence, tier,
      timestamp: new Date().toISOString(),
    });
  }

  emitIngestionBatchCompleted(
    orgId: string, batchId: string,
    autoPlaced: number, needsReview: number, failed: number,
  ) {
    this.server.to(`org:${orgId}`).emit('ingestion:batch:completed', {
      batchId, autoPlaced, needsReview, failed,
      timestamp: new Date().toISOString(),
    });
  }

  emitIngestionFileConverted(orgId: string, fileId: string, documentId: string) {
    this.server.to(`org:${orgId}`).emit('ingestion:file:converted', {
      fileId, documentId, timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('subscribe:workflow')
  handleSubscribeWorkflow(
    @MessageBody() data: { workflowId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`workflow:${data.workflowId}`);
    return { subscribed: true, workflowId: data.workflowId };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { pong: true, timestamp: new Date().toISOString() };
  }
}
