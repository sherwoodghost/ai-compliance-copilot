import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty() role: string;
  @ApiProperty() orgId: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty() expiresIn: number;
  @ApiProperty({ type: AuthUserDto }) user: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() expiresIn: number;
}
