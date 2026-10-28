import { money } from '@core/money/money';
import {
  CaseDetail,
  CaseNote,
  CasePage,
  CaseStatus,
  FailedPaymentCase,
  GraceStatus,
  InboxStatusFilter,
  RetryResult,
} from '../../domain/models';
import {
  CaseDetailDto,
  CaseDto,
  CasePageDto,
  CaseStatusDto,
  GraceStatusDto,
  NoteDto,
  RetryDto,
} from '../dto/failed-payments.dto';

const STATUS: Readonly<Record<CaseStatusDto, CaseStatus>> = {
  PENDIENTE: 'PENDING',
  VENCIDO: 'EXPIRED',
  RECUPERADO: 'RECOVERED',
};

const GRACE: Readonly<Record<GraceStatusDto, GraceStatus>> = {
  VIGENTE: 'CURRENT',
  POR_VENCER: 'DUE_SOON',
  VENCIDA: 'OVERDUE',
};

/** `estado` de la consulta: sin él, el backend devuelve los abiertos (pendientes y vencidos). */
export function toStatusParam(filter: InboxStatusFilter): CaseStatusDto | null {
  if (filter === 'OPEN') return null;
  return (Object.keys(STATUS) as CaseStatusDto[]).find((k) => STATUS[k] === filter) ?? null;
}

export function toCase(dto: CaseDto): FailedPaymentCase {
  return {
    id: dto.id,
    subscriptionId: dto.suscripcion_id,
    clientId: dto.cliente_id,
    status: STATUS[dto.estado],
    amount: money(Number(dto.monto), dto.moneda),
    attempts: dto.intentos,
    lastAttemptAt: new Date(dto.ultimo_intento_en),
    declineCode: dto.codigo_rechazo,
    declineReason: dto.motivo_rechazo,
    graceUntil: new Date(dto.gracia_hasta),
    grace: dto.estado_gracia ? GRACE[dto.estado_gracia] : null,
    card: { brand: dto.tarjeta.marca, last4: dto.tarjeta.ultimos4 },
  };
}

export function toCasePage(dto: CasePageDto): CasePage {
  return { items: dto.items.map(toCase), total: dto.total, page: dto.pagina, size: dto.tamano };
}

export function toNote(dto: NoteDto): CaseNote {
  return {
    id: dto.id,
    authorName: dto.autor_nombre,
    authorRole: dto.autor_rol,
    text: dto.texto,
    createdAt: new Date(dto.creada_en),
  };
}

export function toCaseDetail(dto: CaseDetailDto): CaseDetail {
  return {
    ...toCase(dto),
    retries: dto.reintentos,
    operatorNotifiedAt: dto.operador_notificado_en ? new Date(dto.operador_notificado_en) : null,
    resolvedAt: dto.resuelto_en ? new Date(dto.resuelto_en) : null,
    charges: dto.cobros.map((c) => ({
      transactionId: c.transaccion_id,
      isRetry: c.es_reintento,
      status: c.estado,
      amount: money(Number(c.monto), dto.moneda),
      createdAt: new Date(c.creado_en),
      attempts: c.intentos.map((i) => ({
        number: i.numero,
        result: i.resultado,
        code: i.codigo,
        reason: i.motivo,
        at: new Date(i.fecha),
      })),
    })),
    notes: dto.notas.map(toNote),
  };
}

export function toRetryResult(dto: RetryDto): RetryResult {
  const outcome =
    dto.resultado === 'APROBADO'
      ? 'APPROVED'
      : dto.resultado === 'RECHAZADO'
        ? 'DECLINED'
        : 'IN_PROGRESS';
  const gatewayDetail =
    dto.detalle_pasarela === 'NO_DISPONIBLE'
      ? 'UNAVAILABLE'
      : dto.detalle_pasarela === 'SIN_RESPUESTA'
        ? 'NO_RESPONSE'
        : null;
  return {
    outcome,
    gatewayDetail,
    declineReason: dto.motivo_rechazo,
    caseStatus: STATUS[dto.estado_caso],
    replay: dto.repeticion,
  };
}
