import { ApiError } from '@core/http/api-error';
import {
  escalateErrorMessage,
  eventTypeLabel,
  exportErrorMessage,
  loadErrorMessage,
  magnitudeText,
  paymentStateLabel,
  reconcileErrorMessage,
  reconciliationLabel,
} from './labels';

describe('reconciliation labels', () => {
  it('should name every reconciliation status and payment state', () => {
    expect(reconciliationLabel('PENDING')).toBe('Pendiente');
    expect(reconciliationLabel('RECONCILED')).toBe('Conciliado');
    expect(reconciliationLabel('WITH_DIFFERENCE')).toBe('Con diferencia');
    expect(paymentStateLabel('PAID')).toBe('Pagado');
    expect(paymentStateLabel('FAILED')).toBe('Pago fallido');
    expect(paymentStateLabel('PENDING')).toBe('Pago en curso');
  });

  it('should name the event types and show an unknown one as it came', () => {
    expect(eventTypeLabel('sismo')).toBe('Sismo');
    expect(eventTypeLabel('vuelo_cancelado')).toBe('Vuelo cancelado');
    expect(eventTypeLabel('meteorito')).toBe('meteorito');
    expect(eventTypeLabel(null)).toBe('—');
  });

  it('should describe the magnitude with its name and unit, and fall back to the raw field', () => {
    expect(magnitudeText({ nivel_rio_cm: 172 })).toBe('Nivel del río (cm): 172');
    expect(magnitudeText({ campo_nuevo: 3 })).toBe('campo_nuevo: 3');
    expect(magnitudeText(null)).toBe('—');
    expect(magnitudeText({})).toBe('—');
  });

  it('should give each load failure its own message', () => {
    const kinds = ['unauthenticated', 'forbidden', 'not-found', 'network', 'server'] as const;
    const messages = kinds.map((k) => loadErrorMessage(new ApiError(k, 500)));
    expect(new Set(messages).size).toBe(kinds.length);
    expect(loadErrorMessage(new ApiError('validation', 422))).toBe(messages[4]);
  });

  it('should explain a missing payment in the statement and that nothing changed', () => {
    const m = reconcileErrorMessage(new ApiError('validation', 409, 'EXTRACTO_SIN_PAGO'));
    expect(m).toContain('No se cambió nada');
    expect(
      reconcileErrorMessage(new ApiError('validation', 409, 'DESEMBOLSO_NO_CONCILIABLE')),
    ).toContain('pagados');
    expect(reconcileErrorMessage(new ApiError('network', 0))).toBe(
      loadErrorMessage(new ApiError('network', 0)),
    );
  });

  it('should explain the escalation failures', () => {
    expect(
      escalateErrorMessage(new ApiError('validation', 409, 'DESEMBOLSO_SIN_DIFERENCIA')),
    ).toContain('con diferencia');
    expect(escalateErrorMessage(new ApiError('validation', 422))).toContain('1 a 500');
    expect(escalateErrorMessage(new ApiError('forbidden', 403))).toBe(
      loadErrorMessage(new ApiError('forbidden', 403)),
    );
  });

  it('should tell a session or network problem apart from a failed report', () => {
    expect(exportErrorMessage(new ApiError('network', 0))).toBe(
      loadErrorMessage(new ApiError('network', 0)),
    );
    expect(exportErrorMessage(new ApiError('server', 500))).toContain('reporte');
  });
});
