import { ApiError } from '@core/http/api-error';
import { RETRY_APPROVED } from '../testing/fixtures';
import {
  loadErrorMessage,
  noteErrorMessage,
  retryErrorMessage,
  retryResultKind,
  retryResultMessage,
} from './labels';

describe('failed payments labels', () => {
  it('should give each load failure its own message', () => {
    const kinds = ['unauthenticated', 'forbidden', 'not-found', 'network', 'server'] as const;
    const messages = kinds.map((k) => loadErrorMessage(new ApiError(k, 0)));

    expect(new Set(messages).size).toBe(kinds.length);
    expect(messages[0]).toContain('sesión venció');
  });

  it('should explain a note with a card number apart from a note that is too long', () => {
    expect(
      noteErrorMessage(new ApiError('validation', 422, 'DATO_DE_TARJETA_NO_PERMITIDO')),
    ).toContain('números de tarjeta');
    expect(noteErrorMessage(new ApiError('validation', 422))).toContain('1 a 1000');
  });

  it('should tell an already recovered case, a gateway down and other failures apart', () => {
    expect(retryErrorMessage(new ApiError('validation', 409, 'CASO_YA_RECUPERADO'))).toContain(
      'ya se recuperó',
    );
    expect(retryErrorMessage(new ApiError('server', 503, 'PASARELA_NO_DISPONIBLE'))).toContain(
      'pasarela',
    );
    expect(retryErrorMessage(new ApiError('network', 0))).toContain('conexión');
  });

  it('should make an approval, a decline and a gateway without response distinguishable', () => {
    const declined = {
      ...RETRY_APPROVED,
      outcome: 'DECLINED' as const,
      declineReason: 'Tarjeta bloqueada',
    };
    const unavailable = {
      ...RETRY_APPROVED,
      outcome: 'IN_PROGRESS' as const,
      gatewayDetail: 'UNAVAILABLE' as const,
    };
    const noResponse = { ...unavailable, gatewayDetail: 'NO_RESPONSE' as const };

    expect(retryResultMessage(RETRY_APPROVED)).toContain('aprobado');
    expect(retryResultMessage(declined)).toContain('Tarjeta bloqueada');
    expect(retryResultMessage(unavailable)).toContain('no está disponible');
    expect(retryResultMessage(noResponse)).toContain('no respondió');
    expect(retryResultMessage({ ...noResponse, replay: true })).toContain('Ya hay un reintento');
    expect([
      retryResultKind(RETRY_APPROVED),
      retryResultKind(declined),
      retryResultKind(unavailable),
    ]).toEqual(['success', 'error', 'warning']);
  });
});
