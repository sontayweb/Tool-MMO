export class UsernameNormalizer {
  /**
   * Normalizes a username by:
   * 1. Removing control characters, tabs, and newlines.
   * 2. Trimming leading and trailing whitespaces.
   * 3. Converting to lowercase.
   * Returns empty string if invalid or empty.
   */
  static normalize(username: unknown): string {
    if (typeof username !== 'string') {
      if (username !== null && username !== undefined) {
        return UsernameNormalizer.cleanString(String(username));
      }
      return '';
    }
    return UsernameNormalizer.cleanString(username);
  }

  private static cleanString(str: string): string {
    // Remove control characters, tab, newline, carriage return
    // \x00-\x1F and \x7F-\x9F
    const cleaned = str.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '');
    return cleaned.trim().toLowerCase();
  }

  static readonly INVALID_USERNAMES = new Set([
    'stt', 'stt.', 'no', 'no.', 'username', 'user', 'account', 'tai khoan', 'tên đăng nhập', 
    'tendangnhap', 'tk', 'password', 'pass', 'cookie', 'cookies', 'token', 'email', 'mail',
    'status', 'trang thai', 'trạng thái', 'tong cong', 'tổng cộng', 'ghi chu', 'ghi chú', 
    'note', 'stt/user', 'stt/ten', 'ngay', 'ngày', 'date', 'phone', 'sdt', 'sđt', 'so dien thoai'
  ]);

  static isValid(username: string): boolean {
    const normalized = this.normalize(username);
    if (!normalized || normalized.length < 2) return false;

    // 1. Kiểm tra từ khóa Header / Tiêu đề bảng
    if (this.INVALID_USERNAMES.has(normalized)) return false;

    // 2. Loại bỏ các dòng là đường phân cách (---, ===, ***, ...)
    if (/^[_\-=\*\.\,\#\s]+$/.test(normalized)) return false;

    // 3. Loại bỏ chuỗi là URL hoặc Cookie bị paste nhầm vào ô username
    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.includes('spc_f=') || normalized.includes('.shopee.vn') || normalized.includes('ttwid=')) {
      return false;
    }

    // 4. Loại bỏ Session Token / Device Artifact / UUID / Chuỗi rác quá dài
    if (normalized.startsWith('m.c') || normalized.length > 35 || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(normalized)) {
      return false;
    }

    return true;
  }
}

export const HEADER_ALIASES: Record<string, string[]> = {
  username: ["username", "user", "account", "account_id", "tai khoan", "tk", "tên đăng nhập", "tendangnhap"],
  password: ["password", "pass", "mat khau", "mk", "mật khẩu"],
  cookie: ["cookie", "cookies", "spc_f", "shopee_cookie", "cookie shopee", "cookies shopee"],
  token: ["token", "access_token", "accesstoken"],
  email: ["email", "mail", "hòm thư", "homthu"],
  email_password: ["email_password", "mail_pass", "pass mail", "mat khau mail", "mật khẩu mail", "emailpass", "mailpass"]
};

export class HeaderMapper {
  static mapHeader(rawHeader: string): string | null {
    if (!rawHeader) return null;
    const cleanStr = (s: string) => s.trim().toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-_]/g, '');

    const normalized = cleanStr(rawHeader);

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        if (normalized === cleanStr(alias)) {
          return field;
        }
      }
    }
    return null;
  }
}
