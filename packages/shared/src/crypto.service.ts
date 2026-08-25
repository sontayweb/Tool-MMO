import * as crypto from 'crypto';

export class CryptoService {
  private readonly key: Buffer;

  constructor(keyBase64?: string) {
    const secret = keyBase64 || process.env.ENCRYPTION_KEY_BASE64;
    if (!secret) {
      throw new Error('Encryption key not provided. Set ENCRYPTION_KEY_BASE64 env variable.');
    }

    try {
      this.key = Buffer.from(secret, 'base64');
      if (this.key.length !== 32) {
        throw new Error(`Encryption key must be exactly 32 bytes when decoded. Current size: ${this.key.length} bytes.`);
      }
    } catch (err: any) {
      throw new Error(`Failed to decode encryption key: ${err?.message}`);
    }
  }

  /**
   * Encrypts plain text using AES-256-GCM
   * Returns a colon-separated string: iv_hex:auth_tag_hex:ciphertext_hex
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag().toString('hex');
      
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err: any) {
      throw new Error(`Encryption failed: ${err?.message}`);
    }
  }

  /**
   * Decrypts a colon-separated string: iv_hex:auth_tag_hex:ciphertext_hex
   */
  decrypt(encryptedText: string | null | undefined): string {
    if (!encryptedText) return '';
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
      }

      const [ivHex, authTagHex, ciphertextHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      if (iv.length !== 12 || authTag.length !== 16) {
        throw new Error('Invalid IV or Auth Tag length');
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err: any) {
      throw new Error(`Decryption failed: ${err?.message}`);
    }
  }
}
