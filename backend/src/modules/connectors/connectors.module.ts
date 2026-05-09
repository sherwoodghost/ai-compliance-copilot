import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { SlackConnector } from './slack.connector';
import { GoogleDriveConnector } from './google-drive.connector';

@Module({
  imports:     [],
  controllers: [ConnectorsController],
  providers:   [SlackConnector, GoogleDriveConnector],
  exports:     [SlackConnector, GoogleDriveConnector],
})
export class ConnectorsModule {}
