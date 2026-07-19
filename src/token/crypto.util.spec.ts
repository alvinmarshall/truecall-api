import { decrypt, encrypt } from './crypto.util';

const KEY = 'a'.repeat(64);

describe('crypto utils', () => {
  it('encrypt/decrypt round-trip returns original plaintext', () => {
    const plaintext = 'super-secret-installation-id';
    expect(decrypt(encrypt(plaintext, KEY), KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plaintext = 'same-value';
    expect(encrypt(plaintext, KEY)).not.toBe(encrypt(plaintext, KEY));
  });

  it('throws on tampered ciphertext', () => {
    const enc = encrypt('value', KEY);
    const [iv, tag] = enc.split(':');
    const tampered = [iv, tag, Buffer.from('tampered').toString('base64')].join(
      ':',
    );
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it('throws on wrong key', () => {
    const enc = encrypt('value', KEY);
    const wrongKey = 'b'.repeat(64);
    expect(() => decrypt(enc, wrongKey)).toThrow();
  });
});
