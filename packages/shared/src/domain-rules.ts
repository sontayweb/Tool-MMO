/**
 * DOMAIN RULE ENGINE FOR ARMS MULTI-PLATFORM MMO ACCOUNTS
 * Centralized specifications for validation, data integrity, and junk detection.
 */

export interface IFieldValidationResult {
  isValid: boolean;
  reason?: string;
}

export const ShopeeRules = {
  // Shopee username: 5 to 30 characters, alphanumeric with dots and underscores, cannot be purely numeric
  isValidUsername: (u: string): boolean => {
    if (!u || typeof u !== 'string') return false;
    const clean = u.trim();
    if (clean.length < 4 || clean.length > 30) return false;
    if (/^\d+$/.test(clean)) return false; // Pure machine number or STT
    return /^[a-zA-Z0-9._]{4,30}$/.test(clean);
  },

  // Shopee cookie: Must contain SPC_F core tracking identifier or .shopee.vn
  isValidCookie: (c: string): boolean => {
    if (!c || typeof c !== 'string') return false;
    return /SPC_F=[a-zA-Z0-9_-]{15,45}/i.test(c) || /\.shopee\.vn/i.test(c);
  },

  // Shopee password: 6 to 50 characters, non-whitespace
  isValidPassword: (p: string): boolean => {
    return typeof p === 'string' && p.length >= 6 && p.length <= 50 && !/\s/.test(p);
  },

  // Phone number: Vietnam/International format (9-12 digits)
  isValidPhone: (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    return /^(84|0)[0-9]{8,10}$/.test(phone.trim());
  }
};

export const TikTokRules = {
  // TikTok username: 2 to 24 characters, alphanumeric with dots and underscores
  isValidUsername: (u: string): boolean => {
    if (!u || typeof u !== 'string') return false;
    const clean = u.trim();
    if (clean.length < 2 || clean.length > 24) return false;
    if (/^\d+$/.test(clean)) return false;
    return /^[a-zA-Z0-9._]{2,24}$/.test(clean);
  },

  // TikTok cookie: Must contain sessionid or ttwid
  isValidCookie: (c: string): boolean => {
    if (!c || typeof c !== 'string') return false;
    return /ttwid=[a-zA-Z0-9_%-]{10,}/i.test(c) || /sessionid=[a-zA-Z0-9]{20,}/i.test(c);
  }
};

export const FacebookRules = {
  // Facebook username or numeric UID (10-20 digits)
  isValidUsername: (u: string): boolean => {
    if (!u || typeof u !== 'string') return false;
    const clean = u.trim();
    if (/^\d{10,20}$/.test(clean)) return true; // Numeric UID
    return /^[a-zA-Z0-9.]{5,50}$/.test(clean);
  },

  // Facebook cookie: Must contain c_user and xs
  isValidCookie: (c: string): boolean => {
    if (!c || typeof c !== 'string') return false;
    return /c_user=\d+/i.test(c) && /xs=[^;]+/i.test(c);
  },

  // Facebook token: Starts with EAA
  isValidToken: (t: string): boolean => {
    if (!t || typeof t !== 'string') return false;
    return /^EAA[a-zA-Z0-9]{30,}/.test(t.trim());
  }
};

export const MailRules = {
  // Standard RFC Email specification
  isValidEmail: (e: string): boolean => {
    if (!e || typeof e !== 'string') return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());
  },

  isValidPassword: (p: string): boolean => {
    return typeof p === 'string' && p.length >= 6 && p.length <= 50;
  }
};

export class PlatformRules {
  /**
   * Universal username validator based on platform specification
   */
  static isValidUsername(platform: string | undefined, username: string): boolean {
    if (!username || typeof username !== 'string') return false;
    const clean = username.trim();

    // Reject known table headers and separators
    if (/^[_\-=\*\.\,\#\s]+$/.test(clean)) return false;
    if (['stt', 'username', 'user', 'password', 'cookie', 'token', 'email'].includes(clean.toLowerCase())) return false;

    // Reject pure row numbers / STT numbers
    if (/^\d{1,4}$/.test(clean)) return false;

    // Reject URLs and full cookies mistakenly pasted into username
    if (clean.includes('spc_f=') || clean.includes('http://') || clean.includes('https://') || clean.includes('ttwid=')) {
      return false;
    }

    const upperPlatform = (platform || 'GENERAL').toUpperCase();
    switch (upperPlatform) {
      case 'SHOPEE':
        return ShopeeRules.isValidUsername(clean);
      case 'TIKTOK':
        return TikTokRules.isValidUsername(clean);
      case 'FACEBOOK':
        return FacebookRules.isValidUsername(clean);
      case 'MAIL':
        return MailRules.isValidEmail(clean);
      default:
        // General fallback
        return /^[a-zA-Z0-9._\-@+]{3,35}$/.test(clean) && !/^\d+$/.test(clean);
    }
  }

  /**
   * Determines if an account record possesses core executable credentials
   */
  static hasCoreCredentials(account: {
    password_enc?: string | null;
    cookie_enc?: string | null;
    token_enc?: string | null;
    session_token?: string | null;
  }): boolean {
    return !!(account.password_enc || account.cookie_enc || account.token_enc || account.session_token);
  }

  /**
   * Generates a comprehensive MongoDB query filter to find ALL corrupted / invalid accounts across ALL fields
   */
  static getCorruptedMongoFilter(platform?: string): Record<string, any> {
    const upperPlatform = (platform && platform !== 'ALL') ? platform.toUpperCase() : null;

    let validUsernamePattern = '^[a-zA-Z0-9._\\-@+]{3,35}$';
    if (upperPlatform === 'SHOPEE') validUsernamePattern = '^[a-zA-Z0-9._]{4,30}$';
    else if (upperPlatform === 'TIKTOK') validUsernamePattern = '^[a-zA-Z0-9._]{2,24}$';
    else if (upperPlatform === 'FACEBOOK') validUsernamePattern = '^[a-zA-Z0-9.]{5,50}$|^\\d{10,20}$';

    const conditions: any[] = [
      // 1. Vi phạm quy luật USERNAME (Token Boxphone M.C..., STT số, độ dài > 35, ký tự lạ *, !, hoặc rỗng)
      { username: { $not: { $regex: validUsernamePattern } } },
      { username: { $regex: '^\\s*[0-9]{1,4}\\s*$' } },
      { username: { $regex: '.{36,}' } },
      { username: { $in: [null, ''] } },

      // 2. Vi phạm quy luật EMAIL (Có email nhưng không đúng chuẩn RFC email)
      {
        $and: [
          { email: { $nin: [null, ''] } },
          { email: { $not: { $regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' } } }
        ]
      },

      // 3. Vi phạm DỮ LIỆU CỐT LÕI (Trắng hoàn toàn cả Mật Khẩu LẪN Cookie)
      {
        $and: [
          { $or: [{ cookie_enc: null }, { cookie_enc: '' }] },
          { $or: [{ password_enc: null }, { password_enc: '' }] }
        ]
      }
    ];

    const filter: Record<string, any> = { $or: conditions };
    if (upperPlatform) {
      filter.platform = upperPlatform;
    }
    return filter;
  }

  /**
   * Generates a MongoDB query filter for accounts missing both password and cookie
   */
  static getMissingCoreMongoFilter(platform?: string): Record<string, any> {
    const filter: Record<string, any> = {
      $and: [
        { $or: [{ cookie_enc: null }, { cookie_enc: '' }] },
        { $or: [{ password_enc: null }, { password_enc: '' }] }
      ]
    };
    if (platform && platform !== 'ALL') {
      filter.platform = platform.toUpperCase();
    }
    return filter;
  }

  /**
   * Generates a MongoDB query filter for full-info accounts
   */
  static getFullInfoMongoFilter(platform?: string): Record<string, any> {
    const filter: Record<string, any> = {
      password_enc: { $nin: [null, ''] },
      'quality.has_cookie': true
    };
    if (platform && platform !== 'ALL') {
      filter.platform = platform.toUpperCase();
    }
    return filter;
  }
}
