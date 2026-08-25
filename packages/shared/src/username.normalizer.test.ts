import { UsernameNormalizer, HeaderMapper } from './username.normalizer.js';

describe('UsernameNormalizer', () => {
  it('should clean and lowercase username', () => {
    expect(UsernameNormalizer.normalize('  User001  ')).toBe('user001');
    expect(UsernameNormalizer.normalize('User_Name_123')).toBe('user_name_123');
  });

  it('should remove control characters and whitespace characters', () => {
    // \x07 is control character, \n is newline
    expect(UsernameNormalizer.normalize('User\x07Name\n')).toBe('username');
  });

  it('should return empty string for non-string, null or empty inputs', () => {
    expect(UsernameNormalizer.normalize(null)).toBe('');
    expect(UsernameNormalizer.normalize(undefined)).toBe('');
    expect(UsernameNormalizer.normalize('')).toBe('');
  });

  it('should correctly validate usernames', () => {
    expect(UsernameNormalizer.isValid('  ')).toBe(false);
    expect(UsernameNormalizer.isValid('validUser')).toBe(true);
    expect(UsernameNormalizer.isValid('\x00')).toBe(false);
  });
});

describe('HeaderMapper', () => {
  it('should map standard fields to aliases', () => {
    expect(HeaderMapper.mapHeader('username')).toBe('username');
    expect(HeaderMapper.mapHeader('Account ID')).toBe('username');
    expect(HeaderMapper.mapHeader('Tên Đăng Nhập')).toBe('username');
    expect(HeaderMapper.mapHeader('mật khẩu')).toBe('password');
    expect(HeaderMapper.mapHeader('mk')).toBe('password');
    expect(HeaderMapper.mapHeader('shopee_cookie')).toBe('cookie');
    expect(HeaderMapper.mapHeader('access_token')).toBe('token');
    expect(HeaderMapper.mapHeader('mail_pass')).toBe('email_password');
  });

  it('should return null for unmatched fields', () => {
    expect(HeaderMapper.mapHeader('unknown_column')).toBeNull();
  });
});
