import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SlackConnector } from './slack.connector';
import { ComplianceConnector } from './connector.interface';
import { PrismaService } from '../../database/prisma.service';

interface AuthRequest { user: { orgId: string; userId: string } }

@ApiTags('connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connectors')
export class ConnectorsController {
  private readonly connectors: ComplianceConnector[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly slack:  SlackConnector,
  ) {
    this.connectors = [slack];
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    const creds = await this.prisma.connectorCredential.findMany({
      where:  { orgId: req.user.orgId },
      select: { connectorId: true, status: true, lastSyncAt: true, errorMessage: true },
    });

    return this.connectors.map((c) => {
      const cred = creds.find((cr) => cr.connectorId === c.id);
      return {
        id:          c.id,
        name:        c.name,
        logoUrl:     c.logoUrl,
        controls:    c.supportedControls,
        connected:   cred?.status === 'active',
        status:      cred?.status ?? 'disconnected',
        lastSyncAt:  cred?.lastSyncAt ?? null,
        errorMessage: cred?.errorMessage ?? null,
      };
    });
  }

  @Post(':id/connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() credentials: Record<string, string>,
  ) {
    const connector = this.findConnector(id);
    await connector.connect(req.user.orgId, credentials);
    return { connected: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: AuthRequest, @Param('id') id: string) {
    const connector = this.findConnector(id);
    await connector.disconnect(req.user.orgId);
    return { connected: false };
  }

  @Get(':id/test')
  async test(@Req() req: AuthRequest, @Param('id') id: string) {
    const connector = this.findConnector(id);
    return connector.testConnection(req.user.orgId);
  }

  private findConnector(id: string): ComplianceConnector {
    const c = this.connectors.find((c) => c.id === id);
    if (!c) throw new Error(`Unknown connector: ${id}`);
    return c;
  }
}
