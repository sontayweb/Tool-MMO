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

    // 1. Ưu tiên số 1: Dấu hiệu Cookie / Dữ liệu đặc trưng trong dòng hoặc Tên Tab con
    if (raw.includes('spc_f=') || raw.includes('spc_ec=') || raw.includes('.shopee.vn') || tab.includes('shopee') || tab.includes('shopi')) {
      return 'SHOPEE';
    }
    if (raw.includes('ttwid=') || raw.includes('odin_tt=') || raw.includes('fviainboxes') || raw.includes('smvmail') || tab.includes('tiktok')) {
      return 'TIKTOK';
    }
    if (raw.includes('eaaaa') || tab.includes('facebook') || tab.includes('fb')) {
      return 'FACEBOOK';
    }

    // 2. Ưu tiên số 2: Ngữ cảnh Tên File nguồn
    if (file.includes('shopee') || file.includes('shopi')) {
      return 'SHOPEE';
    }
    if (file.includes('tiktok')) {
      return 'TIKTOK';
    }
    if (file.includes('facebook') || file.includes('fb')) {
      return 'FACEBOOK';
    }

    // 3. Ưu tiên số 3: Mail
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
    const cleanCells: string[] = (row || []).map(c => {
      if (c === null || c === undefined) return '';
      if (typeof c === 'object') {
        return String(c.text || c.result || JSON.stringify(c) || '').trim();
      }
      return String(c).trim();
    });

    const rawLine = cleanCells.join('|');
    const platform = AccountParser.detectPlatform(rawLine, context);

    // Kiểm tra xem trong hàng có cell nào chứa chuỗi pipe đầy đủ không (ví dụ cell cuối chứa pipe token)
    const pipeCell = cleanCells.find(c => c && c.includes('|') && (c.includes('@') || c.includes('M.C') || c.includes('.shopee.vn') || c.includes('SPC_F=')));
    if (pipeCell) {
      const parsed = AccountParser.parseLine(pipeCell, lineNumber, context);
      parsed.raw = rawLine;
      return parsed;
    }

    const cells = cleanCells;
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
    let phone = '';
    let cookie = '';
    let email = '';
    let emailPassword = '';
    let machineId = '';
    let product = '';
    let note = '';
    let coins = '';
    const customMetadata: Record<string, any> = {};

    // 1. Kiểm tra định dạng 6 cột chuẩn Shopee: Username(0), Password(1), Phone(2), Email(3), Pass Mail(4), Cookie(5)
    if (cells.length >= 6 && (cells[5].includes('SPC_F=') || cells[5].includes('SPC_EC=') || cells[5].includes('.shopee.vn') || cells[5].includes('spc_'))) {
      username = cells[0];
      password = cells[1];
      phone = cells[2];
      email = cells[3];
      emailPassword = cells[4];
      cookie = cells[5];

      // Tìm số xu ở cột 6 trở đi
      for (let k = 6; k < cells.length; k++) {
        const val = cells[k];
        if (val.toLowerCase().includes('xu') || (/^\d+$/.test(val) && Number(val) <= 500000)) {
          coins = val;
          break;
        }
      }
    }
    // 2. Kiểm tra định dạng 7 cột chuẩn Shopee có STT: STT(0), Username(1), Password(2), Phone(3), Email(4), Pass Mail(5), Cookie(6)
    else if (cells.length >= 7 && (cells[6].includes('SPC_F=') || cells[6].includes('SPC_EC=') || cells[6].includes('.shopee.vn') || cells[6].includes('spc_'))) {
      username = cells[1];
      password = cells[2];
      phone = cells[3];
      email = cells[4];
      emailPassword = cells[5];
      cookie = cells[6];

      for (let k = 7; k < cells.length; k++) {
        const val = cells[k];
        if (val.toLowerCase().includes('xu') || (/^\d+$/.test(val) && Number(val) <= 500000)) {
          coins = val;
          break;
        }
      }
    }
    // 3. Phân tích linh hoạt theo đặc trưng từng cột (Content-Aware Dynamic Parsing)
    else {
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
        if (emailIdx + 1 < cells.length && cells[emailIdx + 1]) {
          emailPassword = cells[emailIdx + 1];
        }

        const beforeCells = cells.slice(0, emailIdx).filter(c => c.length > 0);
        if (beforeCells.length >= 3) {
          username = beforeCells[0];
          password = beforeCells[1];
          if (/^(84|0)\d{8,11}$/.test(beforeCells[2])) {
            phone = beforeCells[2];
          }
        } else if (beforeCells.length === 2) {
          username = beforeCells[0];
          password = beforeCells[1];
        } else if (beforeCells.length === 1) {
          username = beforeCells[0];
        }

        const afterCells = cells.slice(emailIdx + 2);
        afterCells.forEach((c) => {
          if (!c) return;
          if (c.includes('.shopee.vn') || c.includes('SPC_F=') || c.includes('SPC_EC=') || c.includes('ttwid=')) {
            cookie = c;
          } else if (/^(m\.c\d+|p\d+k\d+|máy\s*\d+|box\s*\d+)$/i.test(c)) {
            machineId = c;
          } else if (c.toLowerCase().includes('xu') || (/^\d+$/.test(c) && Number(c) <= 500000)) {
            coins = c;
          } else if (!product && c.length > 2 && isNaN(Number(c)) && !c.includes('=')) {
            product = c;
          } else {
            note += (note ? ' | ' : '') + c;
          }
        });
      } else {
        let uIdx = 0;
        if (/^\d+$/.test(cells[0]) && cells.length > 1) uIdx = 1;
        username = cells[uIdx] || '';
        password = cells[uIdx + 1] || '';
      }
    }

    // Quét bổ sung Cookie nếu chưa tìm thấy
    if (!cookie) {
      const cookieCell = cells.find(c => c.includes('.shopee.vn') || c.includes('SPC_F=') || c.includes('SPC_EC=') || c.includes('ttwid='));
      if (cookieCell) cookie = cookieCell;
    }

    // Loại trừ username bị lệch format (theo rule Code.gs dòng 1348)
    if (username && (username.includes('@') || username.includes('spc_f') || username.includes('.shopee') || username.length > 35)) {
      username = '';
    }

    if (coins) customMetadata['coins'] = coins;
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
      phone: phone || undefined,
      cookie: cookie || undefined,
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
