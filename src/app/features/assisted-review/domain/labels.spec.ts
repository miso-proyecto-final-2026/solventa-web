import { ApiError } from '@core/http/api-error';
import {
  alreadyDecidedBy,
  categoryLabel,
  decideErrorMessage,
  decisionConsequence,
  decisionLabel,
  loadErrorMessage,
  priorityIcon,
  priorityLabel,
} from './labels';
import { ReviewCategory, ReviewDecision, ReviewPriority } from './models';

describe('assisted review labels', () => {
  it('should give each priority its own icon and text, not only a color', () => {
    const priorities: ReviewPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

    expect(new Set(priorities.map(priorityIcon)).size).toBe(3);
    expect(new Set(priorities.map(priorityLabel)).size).toBe(3);
  });

  it('should label the three categories of the guide', () => {
    const categories: ReviewCategory[] = [
      'RISK_PROFILE_OUT_OF_RANGE',
      'AMOUNT_OVER_LIMIT',
      'INCOMPLETE_OR_INCONSISTENT_DATA',
    ];

    expect(new Set(categories.map(categoryLabel)).size).toBe(3);
  });

  it('should say what each decision will do, charging or closing without charge', () => {
    const decisions: ReviewDecision[] = ['APPROVED', 'REJECTED', 'ADJUSTED'];

    expect(new Set(decisions.map(decisionLabel)).size).toBe(3);
    expect(decisionConsequence('ADJUSTED')).toContain('prima ajustada');
    expect(decisionConsequence('REJECTED')).toContain('sin cobro');
  });

  it('should give each load failure its own message', () => {
    const kinds = ['unauthenticated', 'forbidden', 'not-found', 'network', 'server'] as const;
    const messages = kinds.map((k) => loadErrorMessage(new ApiError(k, 0)));

    expect(new Set(messages).size).toBe(kinds.length);
  });

  it('should read the code before the kind: 409 and 422 both arrive as validation', () => {
    const already = decideErrorMessage(new ApiError('validation', 409, 'REVISION_YA_DECIDIDA'));
    const expired = decideErrorMessage(new ApiError('validation', 409, 'COTIZACION_VENCIDA'));
    const adjustment = decideErrorMessage(new ApiError('validation', 422, 'AJUSTE_INVALIDO'));
    const generic = decideErrorMessage(new ApiError('validation', 422, 'VALIDATION_ERROR'));

    expect(new Set([already, expired, adjustment, generic]).size).toBe(4);
    expect(already).toContain('Otro asesor');
    expect(expired).toContain('venció');
  });

  it('should explain the quote that could not be confirmed and a missing payment method', () => {
    expect(decideErrorMessage(new ApiError('server', 503, 'COTIZACION_NO_DISPONIBLE'))).toContain(
      'vigencia',
    );
    expect(decideErrorMessage(new ApiError('validation', 409, 'SIN_METODO_PAGO'))).toContain(
      'método de pago',
    );
    expect(decideErrorMessage(new ApiError('network', 0))).toContain('conexión');
  });

  it('should read who decided and when from the 409 details', () => {
    const error = new ApiError('validation', 409, 'REVISION_YA_DECIDIDA', [
      { field: 'decision', reason: 'APROBADA' },
      { field: 'asesor', reason: 'Laura Gómez' },
      { field: 'decidido_en', reason: '2026-11-10T09:30:00+00:00' },
    ]);

    const who = alreadyDecidedBy(error);

    expect(who.advisor).toBe('Laura Gómez');
    expect(who.decidedAt?.toISOString()).toBe('2026-11-10T09:30:00.000Z');
    expect(alreadyDecidedBy(new ApiError('validation', 409))).toEqual({
      advisor: '',
      decidedAt: null,
    });
  });
});
