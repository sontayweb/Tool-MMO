import { UsernameNormalizer } from './username.normalizer.js';
import { PlatformRules } from './domain-rules.js';

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
    context?: { source_file?: string; source_tab?: string; default_platform?: string }
  ): 'SHOPEE' | 'TIKTOK' | 'FACEBOOK' | 'MAIL' | 'OTHER' {
    const file = (context?.source_file || '').toLowerCase();
    const tab = (context?.source_tab || '').toLowerCase();
    const raw = text.toLowerCase();

    // ═══════════════════════════════════════════════════════════════════════
    // QUY TẮC VÀNG — THỨ TỰ ƯU TIÊN NHẬN DIỆN NỀN TẢNG (PLATFORM DETECTION)
    //
    // 1. default_platform từ Nguồn Nạp  ← TỐI THƯỢNG (Source-Enforced)
    // 2. Chữ ký Cookie ĐỘC QUYỀN        ← Unambiguous Cookie Fingerprint
    // 3. Tên File / Sheet nguồn         ← File/Tab Context
    // 4. Fallback mặc định: 'SHOPEE'   ← System Default
    //
    // CẤM dùng các dấu hiệu dùng chung để đoán platform:
    //   - @smvmail.com, @fviainboxes.com (mail dùng chung cho cả Shopee lẫn TikTok)
    //   - Token thiết bị M.C... (Boxphone dùng cho cả 2 nền tảng)
    // ═══════════════════════════════════════════════════════════════════════

    // BƯỚC 1: Nguồn Nạp Chỉ Định Platform — TỐI THƯỢNG, không bị lật ngược
    // Nếu ShopeeDriveService / TikTokDriveService / Upload form đã chỉ định platform,
    // chấp nhận ngay lập tức, KHÔNG kiểm tra thêm bất cứ điều kiện nào khác.
    if (context?.default_platform) {
      const upper = context.default_platform.toUpperCase();
      if (['SHOPEE', 'TIKTOK', 'FACEBOOK', 'MAIL'].includes(upper)) {
        return upper as any;
      }
    }

    // BƯỚC 2: Chữ ký Cookie Độc Quyền — Chỉ dùng cookie RIÊNG BIỆT của từng nền tảng
    // (Không dùng domain email hay token máy vì chúng là tài nguyên dùng chung)
    if (raw.includes('spc_f=') || raw.includes('spc_ec=') || raw.includes('.shopee.vn')) {
      return 'SHOPEE';
    }
    if (raw.includes('ttwid=') || raw.includes('odin_tt=') || raw.includes('sessionid=') || raw.includes('passport_csrf_token')) {
      return 'TIKTOK';
    }
    if (raw.includes('c_user=') && (raw.includes('xs=') || raw.includes('datr='))) {
      return 'FACEBOOK';
    }
    if (raw.includes('eaaaa') && raw.includes('eaa')) {
      return 'FACEBOOK'; // Facebook Graph Token
    }

    // BƯỚC 3: Ngữ Cảnh Tên File / Sheet nguồn
    const isShopeeContext =
      file.includes('shopee') || file.includes('shoppee') || file.includes('shoppe') ||
      file.includes('shopper') || file.includes('shopi') || file.includes('shop') ||
      file.includes('xu') || file.includes('đặt đơn') || file.includes('thu xu') || file.includes('rửa xu') ||
      file.includes('chia nick') || file.includes('nick shop') ||
      tab.includes('shopee') || tab.includes('shoppee') || tab.includes('shoppe') ||
      tab.includes('shopper') || tab.includes('shopi') || tab.includes('shop') ||
      tab.includes('xu') || tab.includes('đặt đơn') || tab.includes('thu xu') || tab.includes('rửa xu') ||
      tab.includes('chia nick') || tab.includes('nick shop');

    if (isShopeeContext) {
      return 'SHOPEE';
    }

    const isTikTokContext =
      file.includes('tiktok') || file.includes('tik tok') || file.includes('tt') ||
      tab.includes('tiktok') || tab.includes('tik tok');
    if (isTikTokContext) {
      return 'TIKTOK';
    }

    const isFacebookContext =
      file.includes('facebook') || file.includes('fb ') || file.includes(' fb') ||
      tab.includes('facebook') || tab.includes('fb ') || tab.includes(' fb');
    if (isFacebookContext) {
      return 'FACEBOOK';
    }

    // BƯỚC 4: Fallback — Hệ thống MMO chủ yếu quản lý Shopee
    // Mặc định là SHOPEE nếu không có dấu hiệu nào khác
    return 'SHOPEE';
  }

  /**
   * Bóc tách 1 dòng văn bản (hoặc 1 chuỗi Pipe)
   */
  static parseLine(
    rawLine: string,
    lineNumber = 1,
    context?: { source_file?: string; source_tab?: string; default_platform?: string }
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

    let startIndex = 2;
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

    // Tự động nhận diện nếu cột 0 là số thứ tự STT hoặc mã tiền tố máy (VD: 60 | cgweh128ve | Thanhtu1808@... hoặc Mã 01 | ...)
    if ((/^\d{1,5}$/.test(parts[0]) || /^(mã|may|máy|box|f)\s*\d+$/i.test(parts[0])) && parts.length >= 3 && !parts[1].includes('@') && !parts[1].startsWith('M.C')) {
      if (/^(mã|may|máy|box|f)\s*\d+$/i.test(parts[0])) {
        machineId = parts[0];
      }
      username = parts[1];
      password = parts[2] || '';
      startIndex = 3;
    }

    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // 1. Nhận diện Cookie Shopee
      if (part.includes('SPC_F=') || part.includes('.shopee.vn') || part.toLowerCase().includes('cookie')) {
        cookie = part;
        continue;
      }

      // 2. Nhận diện Session Artifact / Token TikTok (Dạng M.C506_BAY... hoặc JWT/Token dài)
      if (part.startsWith('M.C') || (part.length > 60 && !part.includes('@') && !part.includes(' '))) {
        if (part.includes('|')) {
          const sub = part.split('|');
          sessionToken = sub[0];
          token = sub[0];
          if (sub[1] && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(sub[1])) {
            customMetadata['device_uuid'] = sub[1];
          }
        } else {
          sessionToken = part;
          token = part;
        }
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
    context?: { source_file?: string; source_tab?: string; default_platform?: string }
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

    const cells = cleanCells;
    const nonEmpty = cells.filter(c => c.length > 0);

    // Kiểm tra xem trong hàng có cell nào chứa chuỗi pipe đầy đủ không (ví dụ paste nhầm 1 cục vào 1 ô)
    const pipeCell = cleanCells.find(c => c && c.includes('|') && (c.includes('@') || c.includes('M.C') || c.includes('.shopee.vn') || c.includes('SPC_F=')));
    if (pipeCell) {
      const pipeCount = (pipeCell.match(/\|/g) || []).length;
      // Chỉ ưu tiên parse theo Pipe nếu dòng này có rất ít cột (bị dính vào 1-2 ô) HOẶC ô đó chứa rất nhiều dấu |
      if (nonEmpty.length <= 2 || pipeCount >= 3) {
        const parsed = AccountParser.parseLine(pipeCell, lineNumber, context);
        parsed.raw = rawLine;
        return parsed;
      }
    }

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
    let token = '';
    let sessionToken = '';
    let email = '';
    let emailPassword = '';
    let machineId = '';
    let product = '';
    let note = '';
    let coins = '';
    const customMetadata: Record<string, any> = {};

    // 0.0 Nhận diện cấu trúc ô lồng Pipe: [Mã máy/Folder/Trống] | [Username|Password] | [Email|PassMail|Token]
    const cellWithUserPass = cleanCells.find((c, idx) => (idx <= 1) && c && c.includes('|') && !c.includes('@') && !c.startsWith('M.C') && (c.match(/\|/g) || []).length === 1);
    if (cellWithUserPass) {
      const [u, p] = cellWithUserPass.split('|').map(s => s.trim());
      if (PlatformRules.isValidUsername(platform, u)) {
        username = u;
        password = p;
        for (let i = 0; i < cleanCells.length; i++) {
          const c = cleanCells[i];
          if (!c || c === cellWithUserPass) continue;
          if (/^(f\d+|box\s*\d+|máy\s*\d+|mã\s*\d+)$/i.test(c)) {
            machineId = c;
            continue;
          }
          if (c.includes('|')) {
            const subParts = c.split('|').map(s => s.trim());
            for (const sp of subParts) {
              if (sp.includes('@') && !email) {
                email = sp;
              } else if (sp.startsWith('M.C')) {
                sessionToken = sp;
                token = sp;
              } else if (email && !emailPassword && sp.length < 35 && !sp.startsWith('M.C')) {
                emailPassword = sp;
              } else if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(sp)) {
                customMetadata['device_uuid'] = sp;
              }
            }
          } else {
            if (c.includes('@') && !email) {
              email = c;
            } else if (c.startsWith('M.C')) {
              sessionToken = c;
              token = c;
            } else if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(c)) {
              customMetadata['device_uuid'] = c;
            }
          }
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
    }


    // 0. Bỏ qua các dòng là Proxy hoặc lỗi công thức Excel
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/.test(cells[0])) {
      return {
        raw: rawLine,
        line_number: lineNumber,
        platform: 'OTHER',
        username: '',
        username_normalized: '',
        is_valid: false,
        error_reason: 'INVALID_PROXY_ROW'
      };
    }
    if (cells[0] === '#VALUE!' || cells[0] === '#REF!' || cells[0] === '-' || cells[0].toLowerCase().includes('máy 1')) {
      return {
        raw: rawLine,
        line_number: lineNumber,
        platform: 'OTHER',
        username: '',
        username_normalized: '',
        is_valid: false,
        error_reason: 'INVALID_FORMULA_OR_HEADER'
      };
    }

    // 1. Phân tích TikTok Boxphone có SĐT ở cột 0: SĐT | [] | Username | Email | Pass | M.C...
    if (/^(84|0)\d{8,11}$/.test(cells[0]) && (cells[1] === '[]' || cells[1] === '' || /^[a-zA-Z0-9._]{2,24}$/.test(cells[1]))) {
      let uIdx = 1;
      if (cells[1] === '[]' || cells[1] === '') uIdx = 2;
      phone = cells[0];
      username = cells[uIdx];
      if (cells[uIdx + 1] && cells[uIdx + 1].includes('@')) email = cells[uIdx + 1];
      if (cells[uIdx + 2] && !cells[uIdx + 2].startsWith('M.C')) password = cells[uIdx + 2];
      for (let i = uIdx; i < cells.length; i++) {
        if (cells[i].startsWith('M.C')) {
          const sub = cells[i].split('|');
          sessionToken = sub[0];
          token = sub[0];
          if (sub[1]) customMetadata['device_uuid'] = sub[1];
        }
      }
    }
    // 2. Phân tích TikTok có STT ở cột 0: STT | Username | Pass | Email | PassMail | M.C...
    else if (/^\d{1,5}$/.test(cells[0]) && cells.length >= 4 && cells.some(c => c.startsWith('M.C'))) {
      username = cells[1];
      password = cells[2];
      for (let i = 3; i < cells.length; i++) {
        if (cells[i].includes('@') && !email) {
          email = cells[i];
          if (i + 1 < cells.length && !cells[i + 1].startsWith('M.C') && cells[i + 1].length < 35) {
            emailPassword = cells[i + 1];
          }
        }
        if (cells[i].startsWith('M.C')) {
          const sub = cells[i].split('|');
          sessionToken = sub[0];
          token = sub[0];
          if (sub[1]) customMetadata['device_uuid'] = sub[1];
        }
      }
    }
    // 3. Phân tích Double STT trong Shopee: 0 | 25 | Username | Pass | Phone | Email | PassMail | Cookie
    else if (/^\d+$/.test(cells[0]) && /^\d+$/.test(cells[1]) && cells.length >= 5) {
      username = cells[2];
      password = cells[3];
      phone = /^(84|0)\d{8,11}$/.test(cells[4]) ? cells[4] : '';
      for (let i = 4; i < cells.length; i++) {
        if (cells[i].includes('@') && !email) {
          email = cells[i];
          if (i + 1 < cells.length && !cells[i + 1].includes('@') && !cells[i + 1].includes('SPC_F=')) {
            emailPassword = cells[i + 1];
          }
        }
        if (cells[i].includes('SPC_F=') || cells[i].includes('.shopee.vn')) {
          cookie = cells[i];
        }
      }
    }
    // 4. Kiểm tra định dạng 6 cột Shopee:
    // Case A: STT(0), Username(1), Password(2), Email(3), Pass Mail(4), Cookie(5) (khi ô 0 là số thứ tự)
    // Case B: Username(0), Password(1), Phone(2), Email(3), Pass Mail(4), Cookie(5)
    else if (cells.length >= 6 && (cells[5].includes('SPC_F=') || cells[5].includes('SPC_EC=') || cells[5].includes('.shopee.vn') || cells[5].includes('spc_'))) {
      if (/^\d+$/.test(cells[0]) && cells[3].includes('@')) {
        // Có STT ở cột 0
        username = cells[1];
        password = cells[2];
        phone = '';
        email = cells[3];
        emailPassword = cells[4];
        cookie = cells[5];
      } else {
        // Không có STT ở cột 0
        username = cells[0];
        password = cells[1];
        phone = /^(84|0)\d{8,11}$/.test(cells[2]) ? cells[2] : '';
        email = cells[3].includes('@') ? cells[3] : '';
        emailPassword = cells[4];
        cookie = cells[5];
      }

      // Tìm số xu ở cột 6 trở đi
      for (let k = 6; k < cells.length; k++) {
        const val = cells[k];
        if (val.toLowerCase().includes('xu') || (/^\d+$/.test(val) && Number(val) <= 500000)) {
          coins = val;
          break;
        }
      }
    }
    // 5. Kiểm tra định dạng 7 cột chuẩn Shopee:
    else if (cells.length >= 7 && (cells[6].includes('SPC_F=') || cells[6].includes('SPC_EC=') || cells[6].includes('.shopee.vn') || cells[6].includes('spc_'))) {
      if (/^\d+$/.test(cells[0])) {
        // Có STT ở cột 0
        username = cells[1];
        password = cells[2];
        phone = /^(84|0)\d{8,11}$/.test(cells[3]) ? cells[3] : '';
        email = cells[4].includes('@') ? cells[4] : '';
        emailPassword = cells[5];
        cookie = cells[6];
      } else {
        // Cột 0 KHÔNG PHẢI STT -> Cột 0 chính là USERNAME!
        username = cells[0];
        password = cells[1];
        phone = /^(84|0)\d{8,11}$/.test(cells[2]) ? cells[2] : '';
        email = cells[3].includes('@') ? cells[3] : (cells[4].includes('@') ? cells[4] : '');
        emailPassword = cells[4].includes('@') ? cells[5] : cells[4];
        cookie = cells[6];
      }

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
          if (/^\d+$/.test(beforeCells[0])) {
            // beforeCells = [STT, Username, Password]
            username = beforeCells[1];
            password = beforeCells[2];
          } else {
            username = beforeCells[0];
            password = beforeCells[1];
            if (/^(84|0)\d{8,11}$/.test(beforeCells[2])) {
              phone = beforeCells[2];
            }
          }
        } else if (beforeCells.length === 2) {
          if (/^\d+$/.test(beforeCells[0])) {
            username = beforeCells[1];
          } else {
            username = beforeCells[0];
            password = beforeCells[1];
          }
        } else if (beforeCells.length === 1) {
          username = beforeCells[0];
        }

        const afterCells = cells.slice(emailIdx + 2);
        afterCells.forEach((c) => {
          if (!c) return;
          if (c.includes('.shopee.vn') || c.includes('SPC_F=') || c.includes('SPC_EC=') || c.includes('ttwid=')) {
            cookie = c;
          } else if (c.startsWith('M.C') || (c.length > 60 && !c.includes('@') && !c.includes(' '))) {
            if (c.includes('|')) {
              const sub = c.split('|');
              sessionToken = sub[0];
              token = sub[0];
              if (sub[1] && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(sub[1])) {
                customMetadata['device_uuid'] = sub[1];
              }
            } else {
              sessionToken = c;
              token = c;
            }
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

  static parseText(content: string, context?: { source_file?: string; source_tab?: string; default_platform?: string }): IParsedAccountLine[] {
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
