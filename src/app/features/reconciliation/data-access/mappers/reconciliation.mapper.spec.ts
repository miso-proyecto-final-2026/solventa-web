import {
  fromParam,
  toDisbursement,
  toDisbursementDetail,
  toParam,
  toReconciliationParam,
  toSummary,
} from './reconciliation.mapper';
import { DisbursementDetailDto, DisbursementDto, SummaryDto } from '../dto/reconciliation.dto';

const DTO: DisbursementDto = {
  id: 'ds-1',
  idempotency_key: 'evt-1:pol-1',
  evento_id: 'evt-1',
  tipo_evento: 'sismo',
  magnitud: { magnitud: 6.4 },
  ubicacion: 'bogota',
  evento_ocurrido_en: '2026-11-10T08:30:00Z',
  poliza_id: 'pol-1',
  producto: 'parametrico_clima',
  cliente: 'cli***01',
  numero_poliza: 'POL-00001',
  monto_asegurado: 5000000,
  validacion: {
    resultado: 'CORRESPONDE_PAGO',
    motivo: 'condicion_cumplida',
    regla: 'sismo',
    version_reglas: 'v1',
  },
  estado: 'PAGADA',
  monto: '5000000.00',
  moneda: 'COP',
  referencia_pasarela: 'simpg_abc',
  fecha_pago: '2026-11-10T08:31:00Z',
  intentos: 1,
  reentregas: 2,
  estado_conciliacion: 'CON_DIFERENCIA',
  conciliado_por: 'Olga Operadora',
  conciliado_en: '2026-11-11T10:00:00Z',
  diferencia: {
    monto_registrado: '5000000.00',
    monto_pasarela: '4900000.00',
    moneda_pasarela: 'COP',
    referencia_registrada: 'simpg_abc',
    referencia_pasarela: 'simpg_abc',
  },
  escalada_en: null,
  escalada_por: null,
  nota_escalamiento: null,
  codigo_fallo: null,
  motivo_fallo: null,
};

describe('reconciliation mapper', () => {
  it('should translate the states and keep amounts as numbers with their currency', () => {
    const d = toDisbursement(DTO);

    expect(d.paymentState).toBe('PAID');
    expect(d.reconciliation).toBe('WITH_DIFFERENCE');
    expect(d.amount).toEqual({ amount: 5000000, currency: 'COP' });
    expect(d.insuredAmount).toEqual({ amount: 5000000, currency: 'COP' });
    expect(d.difference?.gatewayAmount.amount).toBe(4900000);
    expect(d.eventAt).toEqual(new Date('2026-11-10T08:30:00Z'));
    expect(d.redeliveries).toBe(2);
    expect(d.client).toBe('cli***01');
  });

  it('should leave the optional data empty when the command did not bring it', () => {
    const d = toDisbursement({
      ...DTO,
      tipo_evento: null,
      magnitud: null,
      evento_ocurrido_en: null,
      numero_poliza: null,
      monto_asegurado: null,
      validacion: null,
      fecha_pago: null,
      diferencia: null,
      estado: 'PENDIENTE',
      estado_conciliacion: 'PENDIENTE',
    });

    expect(d.eventType).toBeNull();
    expect(d.insuredAmount).toBeNull();
    expect(d.validation).toBeNull();
    expect(d.eventAt).toBeNull();
    expect(d.paidAt).toBeNull();
    expect(d.difference).toBeNull();
    expect(d.paymentState).toBe('PENDING');
    expect(d.reconciliation).toBe('PENDING');
  });

  it('should map the payment attempts of the detail', () => {
    const dto: DisbursementDetailDto = {
      ...DTO,
      intentos_de_pago: [
        {
          numero: 1,
          resultado: 'APROBADO',
          codigo: null,
          motivo: null,
          referencia_pasarela: 'simpg_abc',
          fecha: '2026-11-10T08:31:00Z',
        },
      ],
    };

    const d = toDisbursementDetail(dto);

    expect(d.paymentAttempts).toEqual([
      {
        number: 1,
        result: 'APROBADO',
        code: null,
        reason: null,
        reference: 'simpg_abc',
        at: new Date('2026-11-10T08:31:00Z'),
      },
    ]);
  });

  it('should map the summary, with zero for a status the backend left out', () => {
    const dto = {
      desembolsos: 3,
      claves_distintas: 3,
      claves_con_mas_de_un_pago: 0,
      pagados: 3,
      monto_pagado: '15000000.00',
      por_estado_conciliacion: { PENDIENTE: 2, CONCILIADO: 1 },
    } as unknown as SummaryDto;

    expect(toSummary(dto)).toEqual({
      disbursements: 3,
      distinctKeys: 3,
      keysWithMultiplePayments: 0,
      paid: 3,
      paidAmount: { amount: 15000000, currency: 'COP' },
      byReconciliation: { PENDING: 2, RECONCILED: 1, WITH_DIFFERENCE: 0 },
    });
  });

  it('should translate the reconciliation filter and leave "all" without a parameter', () => {
    expect(toReconciliationParam('ALL')).toBeNull();
    expect(toReconciliationParam('PENDING')).toBe('PENDIENTE');
    expect(toReconciliationParam('RECONCILED')).toBe('CONCILIADO');
    expect(toReconciliationParam('WITH_DIFFERENCE')).toBe('CON_DIFERENCIA');
  });

  it('should turn a chosen day into the start and the end of that day', () => {
    expect(fromParam('')).toBeNull();
    expect(toParam('')).toBeNull();
    const from = new Date(fromParam('2026-11-10')!);
    const to = new Date(toParam('2026-11-10')!);
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getMilliseconds()).toBe(999);
    expect(to.getTime() - from.getTime()).toBeGreaterThan(23 * 3_600_000);
  });
});
