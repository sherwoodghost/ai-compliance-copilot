import { Controller, Get, Delete, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('workflows')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.findAll(user.orgId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: JwtPayload) {
    return this.workflowsService.getStats(user.orgId);
  }

  @Get(':workflowId')
  findOne(@CurrentUser() user: JwtPayload, @Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.workflowsService.findOne(user.orgId, workflowId);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get detail of a specific agent run including all steps' })
  getRunDetail(@CurrentUser() user: JwtPayload, @Param('runId', ParseUUIDPipe) runId: string) {
    return this.workflowsService.getRunDetail(user.orgId, runId);
  }

  @Delete(':workflowId')
  cancel(@CurrentUser() user: JwtPayload, @Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.workflowsService.cancel(user.orgId, workflowId);
  }
}
