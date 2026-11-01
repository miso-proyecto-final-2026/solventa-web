import { normalizeCode } from './signature-rules';

describe('normalizeCode', () => {
  it('should keep only the digits, up to the code length', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('12-34-56')).toBe('123456');
    expect(normalizeCode('12345678')).toBe('123456');
    expect(normalizeCode('abc')).toBe('');
  });
});
