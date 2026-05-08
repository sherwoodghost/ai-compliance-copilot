import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { SlackConnector } from './slack.connector';
@Module({
  imports:     [],
  controllers: [ConnectorsController],
  providers:   [SlackConnector],
  exports:     [SlackConnector],
})
export class ConnectorsModule {}
