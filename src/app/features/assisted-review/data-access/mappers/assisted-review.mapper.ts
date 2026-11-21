import { money } from '@core/money/money';
import {
  Adjustment,
  ClientSummary,
  DecisionRequest,
  HumanDecision,
  InboxQuery,
  ProfileLevels,
  ProfileSource,
  QuoteSummary,
  ReviewCategory,
  ReviewDecision,
  ReviewDetail,
  ReviewPage,
  ReviewPriority,
  ReviewRow,
  ReviewState,
  RiskLevel,
} from '../../domain/models';
import {
  AdjustmentDto,
  CategoryDto,
  ClientDto,
  DecisionDto,
  DecisionRequestDto,
  HumanDecisionDto,
  PriorityDto,
  ProfileDto,
  QuoteDto,
  ReviewDetailDto,
  ReviewPageDto,
  ReviewRowDto,
  StateDto,
} from '../dto/assisted-review.dto';

const PRIORITY: Readonly<Record<PriorityDto, ReviewPriority>> = {
  ALTA: 'HIGH',
  MEDIA: 'MEDIUM',
  BAJA: 'LOW',
};

const CATEGORY: Readonly<Record<CategoryDto, ReviewCategory>> = {
  PERFIL_FUERA_DE_RANGO: 'RISK_PROFILE_OUT_OF_RANGE',
  MONTO_SOBRE_LIMITE: 'AMOUNT_OVER_LIMIT',
  DATOS_INCOMPLETOS_O_INCONSISTENTES: 'INCOMPLETE_OR_INCONSISTENT_DATA',
};

const STATE: Readonly<Record<StateDto, ReviewState>> = {
  PENDIENTE: 'PENDING',
  DECIDIDA: 'DECIDED',
};

const DECISION: Readonly<Record<DecisionDto, ReviewDecision>> = {
  APROBADA: 'APPROVED',
  RECHAZADA: 'REJECTED',
  AJUSTADA: 'ADJUSTED',
};

const SOURCE: Readonly<Record<string, ProfileSource>> = {
  REAL: 'REAL',
  POR_DEFECTO: 'DEFAULT',
  DEGRADADO: 'DEGRADED',
};

const LEVEL: Readonly<Record<string, RiskLevel>> = { BAJO: 'LOW', MEDIO: 'MEDIUM', ALTO: 'HIGH' };

function invert<K extends string, V extends string>(map: Readonly<Record<K, V>>) {
  return (value: V): K => (Object.keys(map) as K[]).find((k) => map[k] === value) as K;
}

export const toCategoryParam = invert(CATEGORY);
export const toDecisionDto = invert(DECISION);

/** `estado` de la consulta. */
export const toStateParam = invert(STATE);

const date = (value: string | null): Date | null => (value ? new Date(value) : null);

function toClient(dto: ClientDto | null): ClientSummary | null {
  return dto
    ? {
        firstName: dto.nombre,
        lastNameInitial: dto.inicial_apellido,
        documentType: dto.tipo_documento,
        maskedDocument: dto.documento_enmascarado,
      }
    : null;
}

export function toRow(dto: ReviewRowDto): ReviewRow {
  return {
    id: dto.id,
    client: toClient(dto.cliente),
    product: dto.producto,
    insuredAmount: money(dto.monto_asegurado, dto.moneda),
    categories: dto.categorias.map((c) => CATEGORY[c]),
    reason: dto.motivo,
    createdAt: new Date(dto.creada_en),
    priority: PRIORITY[dto.prioridad],
    state: STATE[dto.estado],
    decision: dto.decision ? DECISION[dto.decision] : null,
    quoteExpired: dto.cotizacion_vencida,
    validUntil: date(dto.vigente_hasta),
  };
}

export function toReviewPage(dto: ReviewPageDto): ReviewPage {
  return {
    items: dto.items.map(toRow),
    total: dto.total,
    expiredTotal: dto.total_vencidas,
    page: dto.pagina,
    size: dto.tamano,
  };
}

function toQuote(dto: QuoteDto): QuoteSummary {
  return {
    quoteId: dto.cotizacion_id,
    product: dto.producto,
    insuredAmount: money(dto.monto_asegurado, dto.moneda),
    monthlyPremium: money(dto.prima_mensual, dto.moneda),
    annualPremium: money(dto.prima_anual, dto.moneda),
    paymentPeriod: dto.periodicidad_pago === 'MENSUAL' ? 'MONTHLY' : 'ANNUAL',
    coverages: dto.coberturas.map((c) => ({
      type: c.tipo,
      amount: money(c.monto, dto.moneda),
      deductible: money(c.deducible, dto.moneda),
    })),
    validUntil: date(dto.vigente_hasta),
  };
}

function toAdjustment(dto: AdjustmentDto | null): Adjustment | null {
  return dto
    ? {
        factor: dto.factor,
        originalAmount: dto.monto_original,
        adjustedAmount: dto.monto_asegurado,
        originalMonthlyPremium: dto.prima_mensual_original,
        monthlyPremium: dto.prima_mensual,
        originalAnnualPremium: dto.prima_anual_original,
        annualPremium: dto.prima_anual,
      }
    : null;
}

function toHuman(dto: HumanDecisionDto | null): HumanDecision | null {
  return dto
    ? {
        decision: DECISION[dto.decision],
        justification: dto.justificacion,
        advisorName: dto.asesor_nombre,
        decidedAt: date(dto.decidido_en),
        adjustment: toAdjustment(dto.ajuste),
      }
    : null;
}

export function toReviewDetail(dto: ReviewDetailDto): ReviewDetail {
  return {
    id: dto.id,
    clientId: dto.cliente_id,
    client: toClient(dto.cliente),
    quote: toQuote(dto.cotizacion),
    automatic: {
      reasons: dto.decision_automatica.motivos.map((m) => ({
        category: CATEGORY[m.categoria],
        text: m.texto,
      })),
      rulesVersion: dto.decision_automatica.reglas_version,
      decidedAt: date(dto.decision_automatica.decidido_en),
    },
    human: toHuman(dto.decision_humana),
    priority: PRIORITY[dto.prioridad],
    state: STATE[dto.estado],
    createdAt: new Date(dto.creada_en),
    quoteExpired: dto.cotizacion_vencida,
    canDecide: dto.puede_decidir,
    allowedDecisions: dto.decisiones_permitidas.map((d) => DECISION[d]),
  };
}

export function toProfileLevels(dto: ProfileDto): ProfileLevels {
  return {
    hasConsent: dto.con_consentimiento,
    source: SOURCE[dto.perfil_fuente] ?? 'DEFAULT',
    completeness: dto.completitud,
    signals: dto.senales.map((s) => ({ name: s.nombre, level: LEVEL[s.nivel] ?? 'MEDIUM' })),
  };
}

export function toDecisionRequestDto(request: DecisionRequest): DecisionRequestDto {
  return {
    decision: toDecisionDto(request.decision),
    justificacion: request.justification.trim(),
    ...(request.decision === 'ADJUSTED' && request.insuredAmount !== null
      ? { monto_asegurado: request.insuredAmount }
      : {}),
  };
}

/** Parámetros de la bandeja que el backend espera. */
export function toListParams(
  query: InboxQuery,
  size: number,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    estado: toStateParam(query.state),
    pagina: query.page,
    tamano: size,
  };
  if (query.category) params['categoria'] = toCategoryParam(query.category);
  if (query.mineOnly) params['mias'] = true;
  if (query.expiredOnly) params['vencidas'] = true;
  return params;
}
