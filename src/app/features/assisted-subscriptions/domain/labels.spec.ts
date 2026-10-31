import { ApiError } from '@core/http/api-error';
import {
  compensationMessage,
  downloadErrorMessage,
  loadErrorMessage,
  sagaStatusLabel,
  signErrorMessage,
  startErrorMessage,
  stepLabel,
} from './labels';
import { SagaStatus, SagaStep } from './models';

describe('assisted subscriptions labels', () => {
  it('should name every saga status and step', () => {
    const statuses: SagaStatus[] = [
      'EN_PROGRESO',
      'APROBADA',
      'COBRO_REALIZADO',
      'FIRMADA',
      'EMITIDA',
      'RECHAZADA',
      'COMPENSADA',
    ];
    const steps: SagaStep[] = ['DECISION', 'COBRO', 'FIRMA', 'EMISION'];

    expect(new Set(statuses.map(sagaStatusLabel)).size).toBe(statuses.length);
    expect(new Set(steps.map(stepLabel)).size).toBe(steps.length);
  });

  it('should explain the compensation by cause and by progress', () => {
    expect(compensationMessage('SOLICITADA', 'FIRMA_FALLIDA')).toContain('identidad');
    expect(compensationMessage('SOLICITADA', 'FIRMA_VENCIDA')).toContain('plazo');
    expect(compensationMessage('COMPLETADA', 'FIRMA_VENCIDA')).toContain('ya se devolvió');
  });

  it('should give each kind of failure its own message', () => {
    const kinds = ['unauthenticated', 'forbidden', 'not-found', 'network', 'server'] as const;
    const messages = kinds.map((k) => loadErrorMessage(new ApiError(k, 500)));

    expect(new Set(messages).size).toBe(kinds.length);
    expect(loadErrorMessage(new ApiError('validation', 422))).toContain('problema del servidor');
  });

  it('should explain each rejection when starting', () => {
    const codes = [
      'COTIZACION_SIN_CUENTA',
      'COTIZACION_VENCIDA',
      'COTIZACION_YA_USADA',
      'COTIZACION_NO_ENCONTRADA',
      'ACCESO_DENEGADO',
      'VALIDATION_ERROR',
    ];
    const messages = codes.map((c) => startErrorMessage(new ApiError('validation', 409, c)));

    expect(new Set(messages).size).toBe(codes.length);
    expect(startErrorMessage(new ApiError('network', 0))).toContain('conexión');
  });

  it('should look at the code before the kind: a wrong code is not a missing permission', () => {
    const noDetail = signErrorMessage(new ApiError('forbidden', 403, 'OTP_INVALIDO'));
    const withDetail = signErrorMessage(
      new ApiError('forbidden', 403, 'OTP_INVALIDO', [
        { field: 'codigo', reason: 'intentos restantes: 1' },
      ]),
    );

    expect(noDetail).toContain('El código no es correcto');
    expect(withDetail).toContain('Intentos restantes: 1');
    expect(signErrorMessage(new ApiError('forbidden', 403, 'ACCESO_DENEGADO'))).toContain(
      'no atendiste',
    );
  });

  it('should say what follows for each signature failure', () => {
    const codes = [
      'FIRMA_VENCIDA',
      'FIRMA_FALLIDA',
      'FIRMA_NO_DISPONIBLE',
      'POLIZA_NO_LISTA',
      'DOCUMENTO_ALTERADO',
    ];

    expect(
      new Set(codes.map((c) => signErrorMessage(new ApiError('validation', 409, c)))).size,
    ).toBe(codes.length);
  });

  it('should explain downloads by HTTP status, since the file request has no code', () => {
    expect(downloadErrorMessage(new ApiError('validation', 409))).toContain(
      'aún no está disponible',
    );
    expect(downloadErrorMessage(new ApiError('forbidden', 403))).toContain('no atendiste');
  });
});
