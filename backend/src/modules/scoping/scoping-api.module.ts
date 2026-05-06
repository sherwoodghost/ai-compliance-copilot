import { Module } from '@nestjs/common';
import { ScopingController } from './scoping.controller';
import { ScopingModule } from '../../scoping/scoping.module';

@Module({
  imports: [ScopingModule],
  controllers: [ScopingController],
})
export class ScopingApiModule {}
