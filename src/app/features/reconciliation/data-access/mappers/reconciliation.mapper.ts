import { Money, money } from '@core/money/money';
import {
  Difference,
  Disbursement,
  DisbursementDetail,
  DisbursementFilters,
  DisbursementPage,
  PaymentState,
  ReconciliationStatus,
  Summary,
} from '../../domain/models';
import {
  DifferenceDto,
  DisbursementDetailDto,
  DisbursementDto,
  DisbursementPageDto,
  PaymentStateDto,
  ReconciliationStatusDto,
  SummaryDto,
} from '../dto/reconciliation.dto';

const PAYMENT: Readonly<Record<PaymentStateDto, PaymentState>> = {
  PENDIENTE: 'PENDING',
  PAGADA: 'PAID',
  FALLIDA: 'FAILED',
};

const RECONCILIATION: Readonly<Record<ReconciliationStatusDto, ReconciliationStatus>> = {
  PENDIENTE: 'PENDING',
  CONCILIADO: 'RECONCILED',
  CON_DIFERENCIA: 'WITH_DIFFERENCE',
};

const date = (value: string | null): Date | null => (value ? new Date(value) : null);

/** `estado_conciliacion` de la consulta; sin él, el backend no filtra. */
export function toReconciliationParam(filter: DisbursementFilters['reconciliation']) {
  if (filter === 'ALL') return null;
  return (
    (Object.keys(RECONCILIATION) as ReconciliationStatusDto[]).find(
      (k) => RECONCILIATION[k] === filter,
    ) ?? null
  );
}

/** Inicio del día elegido, en la hora del navegador, como instante ISO para `desde`. */
export function fromParam(day: string): string | null {
  return day ? new Date(`${day}T00:00:00`).toISOString() : null;
}

/** Fin del día elegido (inclusive), para `hasta`. */
export function toParam(day: string): string | null {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : null;
}

function toDifference(dto: DifferenceDto): Difference {
  return {
    recordedAmount: money(Number(dto.monto_registrado)),
    gatewayAmount: money(Number(dto.monto_pasarela), dto.moneda_pasarela),
    recordedReference: dto.referencia_registrada,
    gatewayReference: dto.referencia_pasarela,
  };
}

export function toDisbursement(dto: DisbursementDto): Disbursement {
  const insured: Money | null =
    dto.monto_asegurado === null || dto.monto_asegurado === undefined
      ? null
      : money(Number(dto.monto_asegurado), dto.moneda);
  return {
    id: dto.id,
    idempotencyKey: dto.idempotency_key,
    eventId: dto.evento_id,
    eventType: dto.tipo_evento,
    magnitude: dto.magnitud,
    location: dto.ubicacion,
    eventAt: date(dto.evento_ocurrido_en),
    policyId: dto.poliza_id,
    product: dto.producto,
    client: dto.cliente,
    policyNumber: dto.numero_poliza,
    insuredAmount: insured,
    validation: dto.validacion && {
      result: dto.validacion.resultado,
      reason: dto.validacion.motivo ?? null,
      rule: dto.validacion.regla ?? null,
      rulesVersion: dto.validacion.version_reglas ?? null,
    },
    paymentState: PAYMENT[dto.estado],
    amount: money(Number(dto.monto), dto.moneda),
    gatewayReference: dto.referencia_pasarela,
    paidAt: date(dto.fecha_pago),
    attempts: dto.intentos,
    redeliveries: dto.reentregas,
    reconciliation: RECONCILIATION[dto.estado_conciliacion],
    reconciledBy: dto.conciliado_por,
    reconciledAt: date(dto.conciliado_en),
    difference: dto.diferencia && toDifference(dto.diferencia),
    escalatedAt: date(dto.escalada_en),
    escalatedBy: dto.escalada_por,
    escalationNote: dto.nota_escalamiento,
    failureCode: dto.codigo_fallo,
    failureReason: dto.motivo_fallo,
  };
}

export function toDisbursementPage(dto: DisbursementPageDto): DisbursementPage {
  return {
    items: dto.items.map(toDisbursement),
    total: dto.total,
    page: dto.pagina,
    size: dto.tamano,
  };
}

export function toDisbursementDetail(dto: DisbursementDetailDto): DisbursementDetail {
  return {
    ...toDisbursement(dto),
    paymentAttempts: dto.intentos_de_pago.map((a) => ({
      number: a.numero,
      result: a.resultado,
      code: a.codigo,
      reason: a.motivo,
      reference: a.referencia_pasarela,
      at: new Date(a.fecha),
    })),
  };
}

export function toSummary(dto: SummaryDto): Summary {
  return {
    disbursements: dto.desembolsos,
    distinctKeys: dto.claves_distintas,
    keysWithMultiplePayments: dto.claves_con_mas_de_un_pago,
    paid: dto.pagados,
    paidAmount: money(Number(dto.monto_pagado)),
    byReconciliation: {
      PENDING: dto.por_estado_conciliacion.PENDIENTE ?? 0,
      RECONCILED: dto.por_estado_conciliacion.CONCILIADO ?? 0,
      WITH_DIFFERENCE: dto.por_estado_conciliacion.CON_DIFERENCIA ?? 0,
    },
  };
}
