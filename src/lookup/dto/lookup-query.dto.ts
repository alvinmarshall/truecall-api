import { IsString, IsNotEmpty } from 'class-validator';

export class LookupQueryDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
