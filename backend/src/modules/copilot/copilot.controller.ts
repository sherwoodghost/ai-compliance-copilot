import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CopilotService, ChatMessage } from './copilot.service';

interface ChatDto {
  message: string;
  history?: ChatMessage[];
}

@ApiTags('copilot')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('copilot')
export class CopilotController {
  constructor(private readonly svc: CopilotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the Compliance Copilot AI' })
  chat(@Req() req: any, @Body() dto: ChatDto) {
    return this.svc.chat(req.user.orgId, dto.message, dto.history ?? []);
  }
}
