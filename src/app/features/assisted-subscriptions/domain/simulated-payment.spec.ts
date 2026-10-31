import { digitsOnly, isValidCardNumber, tokenizeSimulated } from './simulated-payment';

describe('simulated payment', () => {
  it('should produce a token that carries nothing from the card', () => {
    const token = tokenizeSimulated('4242 4242 4242 4242', () => 'uuid');

    expect(token).toBe('tok_sim_uuid');
    expect(token).not.toContain('4242');
  });

  it('should choose the gateway mode with the same test cards as the mobile app', () => {
    expect(tokenizeSimulated('4000000000000002', () => 'u')).toBe('tok_sim_rechazar_u');
    expect(tokenizeSimulated('4000-0000-0000-0119', () => 'u')).toBe('tok_sim_perder_u');
    expect(tokenizeSimulated('4000 0000 0000 0259', () => 'u')).toBe('tok_sim_tardar_u');
  });

  it('should generate a different token each time by default', () => {
    expect(tokenizeSimulated('4242424242424242')).not.toBe(tokenizeSimulated('4242424242424242'));
  });

  it('should accept 13 to 19 digits, with separators', () => {
    expect(digitsOnly('4242 4242-4242')).toBe('424242424242');
    expect(isValidCardNumber('4242 4242 4242 4242')).toBeTrue();
    expect(isValidCardNumber('123456789012')).toBeFalse();
    expect(isValidCardNumber('12345678901234567890')).toBeFalse();
    expect(isValidCardNumber('4242a24242424242')).toBeFalse();
  });
});
