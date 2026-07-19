import { parsePhoneNumber } from 'libphonenumber-js';

export function toE164(raw: string, defaultCountry: string): string {
  try {
    const parsed = parsePhoneNumber(raw, defaultCountry as never);
    if (!parsed.isValid()) throw new Error('Invalid phone number');
    return parsed.format('E.164');
  } catch {
    throw new Error(`Invalid phone number: ${raw}`);
  }
}

export function maskPhone(e164: string): string {
  if (e164.length <= 6) return e164;
  return `${e164.slice(0, e164.length - 4)}****`;
}
