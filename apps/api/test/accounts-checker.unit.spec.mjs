import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AccountsCheckerService } from '../dist/modules/accounts/accounts-checker.service.js';

describe('AccountsCheckerService - Unit Test Suite', () => {
  let service;
  let mockAccountModel;
  let mockCryptoService;
  let mockAuditService;
  let auditLogs;
  let updateOneCalls;

  beforeEach(() => {
    auditLogs = [];
    updateOneCalls = [];

    mockAccountModel = {
      countDocuments: async (filter) => {
        if (filter.health_status === 'UNKNOWN' && filter['metadata.team'] === 'EMPTY_TEAM') {
          return 0;
        }
        return 50;
      },
      find: (query) => ({
        select: () => ({
          limit: (limitNum) => ({
            lean: async () => {
              if (query.username_normalized && query.username_normalized.$in && query.username_normalized.$in.length === 0) {
                return [];
              }
              return [
                {
                  username: 'shopee_user_1',
                  username_normalized: 'shopee_user_1',
                  email: 'user1@example.com',
                  password_enc: 'enc_pass_1',
                  platform: 'SHOPEE',
                  health_status: 'UNKNOWN',
                  status: 'AVAILABLE'
                },
                {
                  username: 'shopee_user_2',
                  username_normalized: 'shopee_user_2',
                  email: '',
                  password_enc: 'enc_pass_corrupt',
                  platform: 'SHOPEE',
                  health_status: 'UNKNOWN',
                  status: 'AVAILABLE'
                }
              ].slice(0, limitNum);
            }
          })
        })
      }),
      updateOne: async (filter, updateOps) => {
        updateOneCalls.push({ filter, updateOps });
        return { acknowledged: true, modifiedCount: 1 };
      }
    };

    mockCryptoService = {
      decrypt: (cipher) => {
        if (cipher === 'enc_pass_corrupt') {
          throw new Error('Decryption failed');
        }
        return 'plain_' + cipher;
      }
    };

    mockAuditService = {
      record: async (entry) => {
        auditLogs.push(entry);
      }
    };

    service = new AccountsCheckerService(
      mockAccountModel,
      mockCryptoService,
      mockAuditService
    );
  });

  describe('1. startSession()', () => {
    it('khởi tạo phiên thành công ở chế độ SELECTED với danh sách username chuẩn hóa', async () => {
      const res = await service.startSession(
        { usernames: ['User.A', 'user.b  '], mode: 'SELECTED' },
        { username: 'admin', role: 'OWNER' }
      );

      assert.strictEqual(res.is_running, true);
      assert.strictEqual(res.status, 'RUNNING');
      assert.strictEqual(res.total, 50);
      assert.strictEqual(res.checked, 0);

      // Kiểm tra audit log
      assert.strictEqual(auditLogs.length, 1);
      assert.strictEqual(auditLogs[0].action, 'SHOPEE_CHECK_SESSION_START');
      assert.strictEqual(auditLogs[0].actor_id, 'admin');
    });

    it('tự động áp dụng filter team cho Actor không phải OWNER/MANAGER', async () => {
      let capturedFilter = null;
      mockAccountModel.countDocuments = async (filter) => {
        capturedFilter = filter;
        return 10;
      };

      await service.startSession(
        { mode: 'UNVERIFIED' },
        { username: 'staff1', role: 'MEMBER', team: 'MARKETING_TEAM' }
      );

      assert.strictEqual(capturedFilter['metadata.team'], 'MARKETING_TEAM');
      assert.strictEqual(capturedFilter.health_status, 'UNKNOWN');
    });

    it('chuyển trạng thái COMPLETED ngay nếu kho không có tài khoản cần quét (total = 0)', async () => {
      mockAccountModel.countDocuments = async () => 0;

      const res = await service.startSession(
        { mode: 'ERRORS_ONLY' },
        { username: 'admin', role: 'OWNER' }
      );

      assert.strictEqual(res.status, 'COMPLETED');
      assert.strictEqual(res.is_running, false);
      assert.strictEqual(res.total, 0);
    });
  });

  describe('2. leaseAccounts()', () => {
    beforeEach(async () => {
      await service.startSession(
        { mode: 'ALL_SHOPEE' },
        { username: 'admin', role: 'OWNER' }
      );
    });

    it('cấp lô tài khoản, giải mã mật khẩu an toàn trong RAM và đánh dấu leased_usernames', async () => {
      const batch = await service.leaseAccounts(2);

      assert.strictEqual(batch.is_running, true);
      assert.strictEqual(batch.accounts.length, 2);

      // Account 1: Giải mã thành công
      assert.strictEqual(batch.accounts[0].username, 'shopee_user_1');
      assert.strictEqual(batch.accounts[0].password, 'plain_enc_pass_1');

      // Account 2: Giải mã lỗi -> fallback chuỗi rỗng an toàn không sập service
      assert.strictEqual(batch.accounts[1].username, 'shopee_user_2');
      assert.strictEqual(batch.accounts[1].password, '');
      assert.strictEqual(batch.accounts[1].email, 'shopee_user_2'); // fallback email = username
    });

    it('không cấp phát tài khoản nếu session không ở trạng thái RUNNING', async () => {
      await service.stopSession({ username: 'admin' });
      const batch = await service.leaseAccounts(5);

      assert.strictEqual(batch.is_running, false);
      assert.strictEqual(batch.accounts.length, 0);
    });

    it('tự động chuyển trạng thái session sang COMPLETED khi DB hết tài khoản', async () => {
      mockAccountModel.find = () => ({
        select: () => ({
          limit: () => ({
            lean: async () => []
          })
        })
      });

      const batch = await service.leaseAccounts(5);
      assert.strictEqual(batch.is_running, false);
      assert.strictEqual(batch.status, 'COMPLETED');
    });
  });

  describe('3. reportSingleResult() - Tuân thủ triệt để Quy tắc nghiệp vụ & Quy tắc 10', () => {
    beforeEach(async () => {
      await service.startSession(
        { mode: 'ALL_SHOPEE' },
        { username: 'admin', role: 'OWNER' }
      );
    });

    it('từ chối bản ghi nếu username rỗng hoặc không hợp lệ', async () => {
      const res = await service.reportSingleResult(
        { username: '   ', status: 'LIVE', error_code: 0 },
        { username: 'WORKER' }
      );

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'Invalid username');
    });

    it('CASE LIVE: Cập nhật AVAILABLE, health_status LIVE, cộng dồn Xu, gỡ tag lỗi cũ và gắn shopee_checked_live', async () => {
      const res = await service.reportSingleResult(
        {
          username: 'shopee_live_user',
          status: 'LIVE',
          error_code: 0,
          coins: 1500,
          elapsed_ms: 220,
          raw_response: { error: 0, data: { user_id: 12345 } }
        },
        { username: 'WORKER' }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 'LIVE');

      // Đối soát lệnh MongoDB updateOne
      assert.strictEqual(updateOneCalls.length, 2);
      // Lệnh 1: $pull gỡ bỏ tag lỗi cũ để tránh xung đột path 'tags'
      assert.deepStrictEqual(updateOneCalls[0].updateOps.$pull, {
        tags: { $in: ['shopee_check_error', 'shopee_check_banned'] }
      });
      // Lệnh 2: Cập nhật trạng thái và $addToSet tag shopee_checked_live
      const mainUpdate = updateOneCalls[1].updateOps;
      assert.strictEqual(mainUpdate.$set.status, 'AVAILABLE');
      assert.strictEqual(mainUpdate.$set.health_status, 'LIVE');
      assert.strictEqual(mainUpdate.$set.coins, 1500);
      assert.strictEqual(mainUpdate.$addToSet.tags, 'shopee_checked_live');

      // Kiểm tra bộ đếm session
      const status = service.getSessionStatus();
      assert.strictEqual(status.live_count, 1);
      assert.strictEqual(status.total_coins, 1500);
      assert.strictEqual(status.checked, 1);
    });

    it('CASE WRONG_PASS: Gán status ERROR (TUYỆT ĐỐI KHÔNG GÁN BLACKLISTED), DEAD, gắn tag shopee_check_error', async () => {
      await service.reportSingleResult(
        {
          username: 'wrong_pass_user',
          status: 'WRONG_PASS',
          error_code: 2,
          error_msg: 'Sai mật khẩu'
        },
        { username: 'WORKER' }
      );

      const mainUpdate = updateOneCalls[updateOneCalls.length - 1].updateOps;
      assert.strictEqual(mainUpdate.$set.status, 'ERROR'); // Đúng chuẩn Rule 10 & Chỉ thị user
      assert.notStrictEqual(mainUpdate.$set.status, 'BLACKLISTED'); // Cấm tuyệt đối
      assert.strictEqual(mainUpdate.$set.health_status, 'DEAD');
      assert.strictEqual(mainUpdate.$set['quality.last_check_result'], 'WRONG_PASS');
      assert.strictEqual(mainUpdate.$addToSet.tags, 'shopee_check_error');

      const status = service.getSessionStatus();
      assert.strictEqual(status.wrong_pass_count, 1);
      assert.strictEqual(status.error_count, 1);
    });

    it('CASE BANNED: Gán status ERROR, DEAD, lưu trọn vẹn JSON phản hồi làm bằng chứng khiếu nại', async () => {
      const mockShopeeBannedJson = {
        error: 9,
        error_type: 'login_phone_f02',
        message: 'Tài khoản của bạn đã bị giới hạn/khóa (F02)'
      };

      await service.reportSingleResult(
        {
          username: 'banned_user',
          status: 'BANNED',
          error_code: 9,
          raw_response: mockShopeeBannedJson
        },
        { username: 'WORKER' }
      );

      const mainUpdate = updateOneCalls[updateOneCalls.length - 1].updateOps;
      assert.strictEqual(mainUpdate.$set.status, 'ERROR');
      assert.strictEqual(mainUpdate.$set.health_status, 'DEAD');
      assert.strictEqual(mainUpdate.$set['quality.last_check_result'], 'BANNED_F02');
      assert.deepStrictEqual(mainUpdate.$set['custom_metadata.check_response'], mockShopeeBannedJson);
      assert.strictEqual(mainUpdate.$addToSet.tags, 'shopee_check_banned');

      const status = service.getSessionStatus();
      assert.strictEqual(status.banned_count, 1);
      assert.strictEqual(status.error_count, 1);
    });

    it('CASE IVS_VERIFY: Gán status ERROR, health_status IVS_PENDING (chờ xác thực OTP)', async () => {
      await service.reportSingleResult(
        {
          username: 'otp_verify_user',
          status: 'IVS_VERIFY',
          error_code: 98,
          error_msg: 'Yêu cầu OTP Mail'
        },
        { username: 'WORKER' }
      );

      const mainUpdate = updateOneCalls[updateOneCalls.length - 1].updateOps;
      assert.strictEqual(mainUpdate.$set.status, 'ERROR');
      assert.strictEqual(mainUpdate.$set.health_status, 'IVS_PENDING');
      assert.strictEqual(mainUpdate.$set['quality.last_check_result'], 'IVS_EMAIL_OTP');
      assert.strictEqual(mainUpdate.$addToSet.tags, 'shopee_check_ivs');

      const status = service.getSessionStatus();
      assert.strictEqual(status.ivs_count, 1);
      assert.strictEqual(status.error_count, 1);
    });

    it('Giới hạn đệm Streaming tối đa 500 bản ghi để bảo vệ RAM', async () => {
      for (let i = 0; i < 505; i++) {
        await service.reportSingleResult(
          { username: `user_${i}`, status: 'LIVE', error_code: 0 },
          { username: 'WORKER' }
        );
      }

      const status = service.getSessionStatus();
      assert.strictEqual(status.recent_results.length, 500);
      assert.strictEqual(status.checked, 505);
      // Kết quả mới nhất luôn nằm ở đầu mảng (index 0)
      assert.strictEqual(status.recent_results[0].username, 'user_504');
    });
  });

  describe('4. stopSession() & getSessionStatus()', () => {
    it('dừng phiên làm việc, cập nhật cờ STOPPED và lưu Audit log', async () => {
      await service.startSession(
        { mode: 'ALL_SHOPEE' },
        { username: 'operator', role: 'MEMBER' }
      );

      const res = await service.stopSession({ username: 'operator' });
      assert.strictEqual(res.is_running, false);
      assert.strictEqual(res.status, 'STOPPED');

      const stopAudit = auditLogs.find(a => a.action === 'SHOPEE_CHECK_SESSION_STOP');
      assert.ok(stopAudit);
      assert.strictEqual(stopAudit.actor_id, 'operator');
    });

    it('tính toán chính xác phần trăm tiến độ, thời gian trôi qua và tốc độ req/s', async () => {
      await service.startSession(
        { mode: 'ALL_SHOPEE' },
        { username: 'admin', role: 'OWNER' }
      );

      // Báo cáo 25 nick
      for (let i = 0; i < 25; i++) {
        await service.reportSingleResult(
          { username: `test_${i}`, status: 'LIVE', error_code: 0 },
          { username: 'WORKER' }
        );
      }

      const status = service.getSessionStatus();
      assert.strictEqual(status.checked, 25);
      assert.strictEqual(status.total, 50);
      assert.strictEqual(status.progress_pct, 50); // 25 / 50 = 50%
      assert.ok(status.speed_per_sec !== undefined);
    });
  });
});
