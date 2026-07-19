import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @IsString()
  @Length(4, 8)
  otp: string;
}
