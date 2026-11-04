import {
  cvcLength,
  detectBrand,
  hasValidPanLength,
  isValidCvc,
  validateExpiry,
} from './card-rules';

const NOW = new Date(2026, 10, 4); // noviembre de 2026

describe('card rules', () => {
  it('should accept the current month and reject a past one', () => {
    expect(validateExpiry('1126', NOW)).toBeNull();
    expect(validateExpiry('1026', NOW)).toBe('past');
    expect(validateExpiry('0125', NOW)).toBe('past');
  });

  it('should reject a month outside 01-12 or a bad format', () => {
    expect(validateExpiry('1328', NOW)).toBe('format');
    expect(validateExpiry('0028', NOW)).toBe('format');
    expect(validateExpiry('11/28', NOW)).toBe('format');
    expect(validateExpiry('', NOW)).toBe('format');
  });

  it('should reject an expiry more than 20 years ahead', () => {
    expect(validateExpiry('1146', NOW)).toBeNull();
    expect(validateExpiry('1246', NOW)).toBe('too-far');
  });

  it('should use the real clock when no date is given', () => {
    expect(validateExpiry('0100')).toBe('past');
  });

  it('should require 4 digits for AMEX and 3 for the rest', () => {
    expect(isValidCvc('1234', detectBrand('3782 822463 10005'))).toBeTrue();
    expect(isValidCvc('123', detectBrand('3782 822463 10005'))).toBeFalse();
    expect(isValidCvc('123', detectBrand('4242 4242 4242 4242'))).toBeTrue();
    expect(isValidCvc('1234', detectBrand('4242 4242 4242 4242'))).toBeFalse();
    expect(isValidCvc('12a', 'VISA')).toBeFalse();
    expect(cvcLength('UNKNOWN')).toBe(3);
  });

  it('should detect the brand', () => {
    expect(detectBrand('4242 4242 4242 4242')).toBe('VISA');
    expect(detectBrand('5555 5555 5555 4444')).toBe('MASTERCARD');
    expect(detectBrand('2221 0000 0000 0009')).toBe('MASTERCARD');
    expect(detectBrand('3782 822463 10005')).toBe('AMEX');
    expect(detectBrand('3056 930902 5904')).toBe('DINERS');
    expect(detectBrand('9999 9999 9999 9999')).toBe('UNKNOWN');
  });

  it('should check the PAN length by brand', () => {
    expect(hasValidPanLength('3782 822463 10005')).toBeTrue();
    expect(hasValidPanLength('3782 8224 6310 0051')).toBeFalse();
    expect(hasValidPanLength('3056 930902 5904')).toBeTrue();
    expect(hasValidPanLength('9999 9999 9999 9999')).toBeTrue();
  });
});
