import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { IAccount, CryptoService, PlatformRules } from '@arms/shared';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class AccountsExportService {
  constructor(
    @InjectModel('Account') private readonly accountModel: Model<IAccount>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService
  ) {}

  async exportExcelStream(
    query: {
      platform?: string;
      machine_id?: string;
      status?: string;
      source_file?: string;
      source_sheet?: string;
      managed_by?: string;
      team?: string;
      date_from?: string;
      date_to?: string;
      batch_id?: string;
      search?: string;
      data_quality?: string;
      tags?: string;
    },
    user: { username: string; role: string; team?: string },
    res: any
  ) {
    const filter: any = {};

    // Team Data Isolation Enforcement
    if (user.role !== 'OWNER' && user.role !== 'MANAGER' && user.team && user.team !== 'ALL') {
      filter['metadata.team'] = user.team;
    } else if (query.team && query.team !== 'ALL') {
      filter['metadata.team'] = query.team;
    }

    if (query.platform && query.platform !== 'ALL') filter.platform = query.platform;
    if (query.machine_id) filter.machine_id = query.machine_id;
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    } else {
      filter.status = { $ne: 'TRASH' };
    }
    if (query.source_file) filter['metadata.source_file'] = query.source_file;
    if (query.source_sheet) filter['metadata.source_sheet'] = query.source_sheet;
    if (query.managed_by) filter['metadata.managed_by'] = query.managed_by;
    if (query.batch_id) filter['metadata.batch_id'] = query.batch_id;

    if (query.date_from || query.date_to) {
      filter['metadata.last_scan_at'] = {};
      if (query.date_from) filter['metadata.last_scan_at'].$gte = new Date(query.date_from);
      if (query.date_to) filter['metadata.last_scan_at'].$lte = new Date(query.date_to);
    }

    if (query.search) {
      filter.$or = [
        { username: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { 'metadata.notes': { $regex: query.search, $options: 'i' } },
        { 'metadata.source_file': { $regex: query.search, $options: 'i' } },
        { 'metadata.source_sheet': { $regex: query.search, $options: 'i' } }
      ];
    }

    // Domain Rule Engine - Data Quality Filtering
    if (query.data_quality === 'corrupted' || query.data_quality === 'corrupted_username') {
      const corruptedFilter = PlatformRules.getCorruptedMongoFilter(query.platform);
      if (!filter.$and) {
        filter.$and = [];
      }
      if (filter.$or) {
        filter.$and.push({ $or: filter.$or });
        delete filter.$or;
      }
      if (corruptedFilter.$and) {
        filter.$and.push(...corruptedFilter.$and);
      } else if (corruptedFilter.$or) {
        filter.$and.push({ $or: corruptedFilter.$or });
      }
      delete filter.status;
    } else if (query.data_quality === 'missing_core') {
      const missingFilter = PlatformRules.getMissingCoreMongoFilter(query.platform);
      if (!filter.$and) filter.$and = [];
      filter.$and.push(...missingFilter.$and);
    } else if (query.data_quality === 'full_info') {
      const fullInfoFilter = PlatformRules.getFullInfoMongoFilter(query.platform);
      if (!filter.$and) filter.$and = [];
      filter.$and.push(fullInfoFilter);
    } else if (query.data_quality === 'has_cookie') {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: [{ 'quality.has_cookie': true }, { cookie_enc: { $nin: [null, ''] } }] });
    } else if (query.data_quality === 'has_token') {
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: [{ 'quality.has_token': true }, { token_enc: { $nin: [null, ''] } }, { session_token: { $nin: [null, ''] } }] });
    } else if (query.data_quality === 'has_email') {
      filter.email = { $nin: [null, ''] };
    }

    if (query.tags) {
      const tagList = query.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (tagList.length > 0) filter.tags = { $all: tagList };
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `ARMS_Export_${query.platform || 'ALL'}_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true
    });

    const worksheet = workbook.addWorksheet('Danh Sách Tài Khoản');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Nền Tảng', key: 'platform', width: 12 },
      { header: 'Username / Tên Đăng Nhập', key: 'username', width: 25 },
      { header: 'Mật Khẩu', key: 'password', width: 22 },
      { header: 'Email Gốc', key: 'email', width: 30 },
      { header: 'Pass Mail', key: 'email_password', width: 20 },
      { header: 'Cookie Phiên', key: 'cookie', width: 45 },
      { header: 'Token Phiên', key: 'token', width: 30 },
      { header: 'Mã Máy / Device', key: 'machine_id', width: 15 },
      { header: 'Trạng Thái', key: 'status', width: 16 },
      { header: 'File Nguồn', key: 'source_file', width: 28 },
      { header: 'Tab Nguồn', key: 'source_sheet', width: 20 },
      { header: 'Ngày Quét', key: 'last_scan', width: 16 },
      { header: 'Ghi Chú', key: 'notes', width: 25 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6B21A8' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.commit();

    const cursor = this.accountModel.find(filter).sort({ createdAt: -1 }).cursor();
    let index = 1;

    for await (const doc of cursor) {
      let pass = '';
      let cookie = '';
      let token = '';
      let emailPass = '';

      if (user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'MEMBER') {
        if (doc.password_enc) pass = this.cryptoService.decrypt(doc.password_enc);
        if (doc.cookie_enc) cookie = this.cryptoService.decrypt(doc.cookie_enc);
        if (doc.token_enc) token = this.cryptoService.decrypt(doc.token_enc);
        if (doc.email_password_enc) emailPass = this.cryptoService.decrypt(doc.email_password_enc);
      }

      const row = worksheet.addRow({
        stt: index++,
        platform: doc.platform || 'OTHER',
        username: doc.username || '',
        password: pass,
        email: doc.email || '',
        email_password: emailPass,
        cookie: cookie,
        token: token,
        machine_id: doc.machine_id || '',
        status: doc.status || 'AVAILABLE',
        source_file: doc.metadata?.source_file || '',
        source_sheet: doc.metadata?.source_sheet || '',
        last_scan: doc.metadata?.last_scan_at ? new Date(doc.metadata.last_scan_at).toISOString().slice(0, 10) : '',
        notes: (doc.metadata as any)?.notes || ''
      });

      row.commit();
    }

    worksheet.commit();
    await workbook.commit();

    await this.auditService.record({
      action: 'EXPORT_EXCEL',
      actor_id: user.username,
      actor_username: user.username,
      platform: query.platform || 'ALL',
      target_type: 'ACCOUNTS_EXCEL',
      details: {
        count: index - 1,
        platform: query.platform || 'ALL',
        status: query.status || 'AVAILABLE',
        team: query.team || user.team || 'ALL'
      }
    });
  }
}
