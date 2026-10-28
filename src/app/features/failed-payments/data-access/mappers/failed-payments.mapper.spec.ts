import { CaseDto, RetryDto } from '../dto/failed-payments.dto';
import { toCase, toRetryResult, toStatusParam } from './failed-payments.mapper';

describe('failed payments mapper', () => {
  const dto: CaseDto = {
    id: 'tx-1',
    suscripcion_id: 'sus-1',
    cliente_id: 'cli-1',
    estado: 'RECUPERADO',
    monto: '1234.50',
    moneda: 'COP',
    intentos: 3,
    ultimo_intento_en: '2026-10-28T15:00:00Z',
    codigo_rechazo: null,
    motivo_rechazo: null,
    gracia_hasta: '2026-10-31T15:00:00Z',
    estado_gracia: null,
    tarjeta: { marca: null, ultimos4: null },
  };

  it('should translate the case status and keep a recovered case without grace', () => {
    const c = toCase(dto);

    expect(c.status).toBe('RECOVERED');
    expect(c.grace).toBeNull();
    expect(c.amount).toEqual({ amount: 1234.5, currency: 'COP' });
    expect(c.graceUntil.toISOString()).toBe('2026-10-31T15:00:00.000Z');
  });

  it('should map every grace status', () => {
    expect(toCase({ ...dto, estado_gracia: 'VIGENTE' }).grace).toBe('CURRENT');
    expect(toCase({ ...dto, estado_gracia: 'POR_VENCER' }).grace).toBe('DUE_SOON');
    expect(toCase({ ...dto, estado_gracia: 'VENCIDA' }).grace).toBe('OVERDUE');
  });

  it('should leave the status out for the open cases and translate the rest', () => {
    expect(toStatusParam('OPEN')).toBeNull();
    expect(toStatusParam('PENDING')).toBe('PENDIENTE');
    expect(toStatusParam('RECOVERED')).toBe('RECUPERADO');
  });

  it('should tell a decline, an approval and a gateway without response apart', () => {
    const base: RetryDto = {
      caso_id: 'tx-1',
      transaccion_id: 'tx-2',
      numero_reintento: 1,
      resultado: 'RECHAZADO',
      codigo_rechazo: 'TARJETA_BLOQUEADA',
      motivo_rechazo: 'Tarjeta bloqueada',
      detalle_pasarela: null,
      estado_caso: 'PENDIENTE',
      repeticion: true,
    };

    expect(toRetryResult(base)).toEqual({
      outcome: 'DECLINED',
      gatewayDetail: null,
      declineReason: 'Tarjeta bloqueada',
      caseStatus: 'PENDING',
      replay: true,
    });
    expect(
      toRetryResult({ ...base, resultado: 'APROBADO', estado_caso: 'RECUPERADO' }).outcome,
    ).toBe('APPROVED');
    expect(
      toRetryResult({ ...base, resultado: 'EN_PROCESO', detalle_pasarela: 'SIN_RESPUESTA' })
        .gatewayDetail,
    ).toBe('NO_RESPONSE');
  });
});
