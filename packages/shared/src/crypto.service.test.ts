import { CryptoService } from './crypto.service.js';

describe('CryptoService', () => {
  const validKeyBase64 = 'H0dTb4DmjdI8Gp7j34qIrhf6fXDHzdOZYKGABwPJwUA=';

  it('should encrypt and decrypt a string correctly', () => {
    const cryptoService = new CryptoService(validKeyBase64);
    const plainText = 'my-secret-password-123';
    
    const encrypted = cryptoService.encrypt(plainText);
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(':');
    
    // Decrypt and compare
    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should fail initialization if key is not provided', () => {
    expect(() => new CryptoService('')).toThrow('Encryption key not provided');
  });

  it('should fail initialization if key is not 32 bytes', () => {
    // 16 bytes key in base64: c29tZSBzaGVldCBrZXkgMTI=
    const shortKeyBase64 = 'c29tZSBzaGVldCBrZXkgMTI=';
    expect(() => new CryptoService(shortKeyBase64)).toThrow('must be exactly 32 bytes');
  });

  it('should fail decryption if format is invalid', () => {
    const cryptoService = new CryptoService(validKeyBase64);
    expect(() => cryptoService.decrypt('invalid_format')).toThrow('Invalid encrypted format');
  });
});
