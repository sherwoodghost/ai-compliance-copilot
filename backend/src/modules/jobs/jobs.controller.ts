import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':jobId/status')
  async getJobStatus(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.prisma.jobStatus.findFirst({
      where: { id: jobId, orgId: user.orgId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      resultPayload: job.resultPayload,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  @Get()
  async listJobs(@CurrentUser() user: JwtPayload) {
    return this.prisma.jobStatus.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, status: true, progress: true, createdAt: true, updatedAt: true },
    });
  }
}
