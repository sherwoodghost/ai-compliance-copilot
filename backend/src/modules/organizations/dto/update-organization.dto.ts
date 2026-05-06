import { PartialType } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @ApiPropertyOptional({ description: 'Organization-level settings JSON' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
