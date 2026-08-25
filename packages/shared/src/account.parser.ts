import { UsernameNormalizer } from './username.normalizer.js';

export interface IParsedAccountLine {
  raw: string;
  line_number: number;
  platform: 'SHOPEE' | 'TIKTOK' | 'FACEBOOK' | 'MAIL' | 'OTHER';
  username: string;
  username_normalized: string;
  password?: string;
  phone?: string;
  cookie?: string;
  token?: string;
  session_token?: string;
  machine_id?: string;
  email?: string;
  email_password?: string;
  custom_metadata?: Record<string, any>;
  is_valid: boolean;
  error_reason?: string;
}

export class AccountParser {
  /**
   * Tự động phát hiện nền tảng dựa trên ngữ cảnh file / tab / chuỗi
   */
  static detectPlatform(
    text: string,
    context?: { source_file?: string; source_tab?: string }
  ): 'SHOPEE' | 'TIKTOK' | 'FACEBOOK' | 'MAIL' | 'OTHER' {
    const file = (context?.source_file || '').toLowerCase();
    const tab = (context?.source_tab || '').toLowerCase();
    const raw = text.toLowerCase();

    if (file.includes('tiktok') || tab.includes('tiktok') || raw.includes('fviainboxes') || raw.includes('smvmail') || raw.includes('tiktok')) {
      return 'TIKTOK';
    }
    if (file.includes('shopee') || file.includes('shopi') || tab.includes('shopee') || tab.includes('shopi') || raw.includes('spc_f=') || raw.includes('.shopee.vn')) {
      return 'SHOPEE';
    }
    if (file.includes('facebook') || file.includes('fb') || tab.includes('facebook')) {
      return 'FACEBOOK';
    }
    if (raw.includes('@hotmail') || raw.includes('@gmail') || raw.includes('@outlook')) {
      return 'MAIL';
    }
    return 'OTHER';
  }

  /**
   * Bóc tách 1 dòng văn bản (hoặc 1 chuỗi Pipe)
   */
  static parseLine(
    rawLine: string,
    lineNumber = 1,
    context?: { source_file?: string; source_tab?: string }
  ): IParsedAccountLine {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return {
        raw: rawLine,
        line_number: lineNumber,
        platform: 'OTHER',
        username: '',
        username_normalized: '',
        is_valid: false,
        error_reason: 'EMPTY_LINE'
      };
    }

    const platform = AccountParser.detectPlatform(trimmed, context);

    let separator = '|';
    if (trimmed.includes('|')) separator = '|';
    else if (trimmed.includes('\t')) separator = '\t';
    else if (trimmed.includes(';') && !trimmed.includes(':')) separator = ';';
    else if (trimmed.includes(':') && (trimmed.match(/:/g) || []).length <= 4 && !trimmed.startsWith('http')) separator = ':';

    const parts = trimmed.split(separator).map(s => s.trim());

    if (parts.length === 0 || !parts[0]) {
      return {
        raw: rawLine,
        line_number: lineNumber,
        platform,
        username: '',
        username_normalized: '',
        is_valid: false,
        error_reason: 'MISSING_USERNAME'
      };
    }

    let username = parts[0];
    let password = parts[1] || '';
    let phone: string | undefined;
    let cookie: string | undefined;
    let token: string | undefined;
    let sessionToken: string | undefined;
    let machineId: string | undefined;
    let email: string | undefined;
    let emailPassword: string | undefined;
    const customMetadata: Record<string, any> = {};

    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // 1. Nhận diện Cookie Shopee
      if (part.includes('SPC_F=') || part.includes('.shopee.vn') || part.toLowerCase().includes('cookie')) {
        cookie = part;
        continue;
      }

      // 2. Nhận diện Session Artifact / Token TikTok (Dạng M.C506_BAY... hoặc JWT/Token dài)
      if (part.startsWith('M.C') || (part.length > 60 && !part.includes('@') && !part.includes(' '))) {
        sessionToken = part;
        token = part;
        continue;
      }

      // 3. Nhận diện Email (Hotmail, Gmail, Outlook, SMVMail, Fviainboxes)
      if (part.includes('@') && (part.includes('.') || part.includes('hotmail') || part.includes('gmail') || part.includes('yahoo') || part.includes('outlook') || part.includes('smvmail') || part.includes('fviainboxes'))) {
        if (!email) {
          email = part;
          if (i + 1 < parts.length) {
            const nextPart = parts[i + 1];
            if (nextPart && !nextPart.includes('@') && !nextPart.startsWith('M.C') && nextPart.length < 50) {
              emailPassword = nextPart;
              i++;
            }
          }
        } else {
          customMetadata[`alias_email_${i}`] = part;
        }
        continue;
      }

      // 4. Nhận diện Mã Máy Boxphone (Dạng p2k1, p2k2, Box 1, Máy 1)
      if (/^(p\d+k\d+|máy\s*\d+|box\s*\d+)$/i.test(part)) {
        machineId = part;
        continue;
      }

      // 5. Nhận diện Số điện thoại
      if (/^(84|0)\d{8,11}$/.test(part)) {
        phone = part;
        continue;
      }

      // 6. Nhận diện UUID thiết bị
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
        customMetadata['device_uuid'] = part;
        continue;
      }

      // 7. Nhận diện Token thường
      if (!token && part.length >= 30 && !cookie) {
        token = part;
        continue;
      }

      // 8. Nếu chưa có pass mail và gặp chuỗi
      if (email && !emailPassword && part.length < 35 && !part.includes(' ')) {
        emailPassword = part;
        continue;
      }

      // Gom các trường còn lại vào metadata
      customMetadata[`extra_field_${i}`] = part;
    }

    if (parts.length >= 6 && !cookie && parts[5].includes('SPC_F=')) {
      cookie = parts[5];
    }

    const usernameNorm = UsernameNormalizer.normalize(username);
    const isValid = UsernameNormalizer.isValid(usernameNorm);

    return {
      raw: rawLine,
      line_number: lineNumber,
      platform,
      username,
      username_normalized: usernameNorm,
      password: password || undefined,
      phone: phone || undefined,
      cookie: cookie || undefined,
      token: token || undefined,
      session_token: sessionToken || undefined,
      machine_id: machineId || undefined,
      email: email || undefined,
      email_password: emailPassword || undefined,
      custom_metadata: Object.keys(customMetadata).length > 0 ? customMetadata : undefined,
      is_valid: isValid,
      error_reason: isValid ? undefined : 'INVALID_USERNAME'
    };
  }

  /**
   * Bóc tách 1 hàng mảng Cell từ Google Sheets / Excel (Column-Agnostic)
   */
  static parseRow(
    row: any[],
    lineNumber = 1,
    context?: { source_file?: string; source_tab?: string }
  ): IParsedAccountLine {
    const rawLine = row.map(c => c !== undefined && c !== null ? String(c) : '').join('|');
    const platform = AccountParser.detectPlatform(rawLine, context);

    // Kiểm tra xem trong hàng có cell nào chứa chuỗi pipe đầy đủ không (ví dụ cell cuối chứa pipe token)
    const pipeCell = row.find(c => typeof c === 'string' && c.includes('|') && (c.includes('@') || c.includes('M.C')));
    if (pipeCell) {
      const parsed = AccountParser.parseLine(String(pipeCell), lineNumber, context);
      parsed.raw = rawLine;
      return parsed;
    }

    const cells = row.map(c => c !== undefined && c !== null ? String(c).trim() : '');
    const nonEmpty = cells.filter(c => c.length > 0);

    if (nonEmpty.length === 0) {
      return {
        raw: rawLine,
        line_number: lineNumber,
        platform,
        username: '',
        username_normalized: '',
        is_valid: false,
        error_reason: 'EMPTY_ROW'
      };
    }

    let username = '';
    let password = '';
    let email = '';
    let emailPassword = '';
    let machineId = '';
    let product = '';
    let note = '';
    const customMetadata: Record<string, any> = {};

    // 1. Quét tìm Email trước
    let emailIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.includes('@') && (c.includes('.') || c.includes('hotmail') || c.includes('gmail') || c.includes('outlook'))) {
        email = c;
        emailIdx = i;
        break;
      }
    }

    if (emailIdx !== -1) {
      // Cell liền sau Email thường là Pass Mail
      if (emailIdx + 1 < cells.length && cells[emailIdx + 1]) {
        emailPassword = cells[emailIdx + 1];
      }

      // Các cell đứng trước Email là Username và Password
      const beforeCells = cells.slice(0, emailIdx).filter(c => c.length > 0);
      if (beforeCells.length >= 2) {
        // Kiểm tra xem cell đầu có phải STT (số 1, 2, 3...) không
        if (/^\d+$/.test(beforeCells[0]) && beforeCells.length >= 3) {
          username = beforeCells[1];
          password = beforeCells[2];
        } else {
          username = beforeCells[0];
          password = beforeCells[1];
        }
      } else if (beforeCells.length === 1) {
        username = beforeCells[0];
      }

      // Các cell đứng sau Pass Mail là Product, Machine, Note
      const afterCells = cells.slice(emailIdx + 2);
      afterCells.forEach((c, idx) => {
        if (!c) return;
        if (/^(p\d+k\d+|máy\s*\d+|box\s*\d+)$/i.test(c)) {
          machineId = c;
        } else if (!product && c.length > 2 && isNaN(Number(c))) {
          product = c;
        } else {
          note += (note ? ' | ' : '') + c;
        }
      });

    } else {
      // Không có email, lấy theo thứ tự tự nhiên
      let uIdx = 0;
      if (/^\d+$/.test(cells[0]) && cells.length > 1) uIdx = 1;
      username = cells[uIdx] || '';
      password = cells[uIdx + 1] || '';
    }

    if (product) customMetadata['product'] = product;
    if (note) customMetadata['note'] = note;

    const usernameNorm = UsernameNormalizer.normalize(username);
    const isValid = UsernameNormalizer.isValid(usernameNorm);

    return {
      raw: rawLine,
      line_number: lineNumber,
      platform,
      username,
      username_normalized: usernameNorm,
      password: password || undefined,
      machine_id: machineId || undefined,
      email: email || undefined,
      email_password: emailPassword || undefined,
      custom_metadata: Object.keys(customMetadata).length > 0 ? customMetadata : undefined,
      is_valid: isValid,
      error_reason: isValid ? undefined : 'INVALID_USERNAME'
    };
  }

  static parseText(content: string, context?: { source_file?: string; source_tab?: string }): IParsedAccountLine[] {
    const lines = content.split(/\r?\n/);
    const results: IParsedAccountLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) continue;
      results.push(AccountParser.parseLine(line, i + 1, context));
    }

    return results;
  }
}
