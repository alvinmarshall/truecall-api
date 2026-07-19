import { maskPhone, toE164 } from './phone.util';

describe('toE164', () => {
  it('converts local Ghana number to E.164', () => {
    expect(toE164('0201234567', 'GH')).toBe('+233201234567');
  });

  it('passes through already-formatted E.164', () => {
    expect(toE164('+233201234567', 'GH')).toBe('+233201234567');
  });

  it('handles international format without +', () => {
    expect(toE164('+2348012345678', 'NG')).toBe('+2348012345678');
  });

  it('throws on invalid number', () => {
    expect(() => toE164('abc', 'GH')).toThrow('Invalid phone number');
  });

  it('throws on empty string', () => {
    expect(() => toE164('', 'GH')).toThrow('Invalid phone number');
  });
});

describe('maskPhone', () => {
  it('masks last 4 digits', () => {
    expect(maskPhone('+233201234567')).toBe('+23320123****');
  });

  it('returns short numbers unchanged', () => {
    expect(maskPhone('+1234')).toBe('+1234');
  });
});
