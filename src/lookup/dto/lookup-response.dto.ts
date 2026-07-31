export class LookupResponseDto {
  phone: string;
  name: string;
  score: number;
  carrier: string;
  lineType: string;
  country: string;
  spamScore: number;
  isSpam: boolean;
  cached: boolean;
  lookedUpAt: string;
}
