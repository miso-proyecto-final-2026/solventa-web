import { money } from '@core/money/money';
import {
  AssistedSubscription,
  SagaStatus,
  SagaStep,
  SignRequest,
  SignatureDocument,
  SignatureResult,
  SignatureStatus,
  StartRequest,
  SubscriptionPage,
} from '../../domain/models';
import {
  AssistedSubscriptionDto,
  SignatureDocumentDto,
  SignatureDto,
  SubscriptionPageDto,
} from '../dto/assisted-subscriptions.dto';

const SIGNATURE_STATUS: Readonly<Record<string, SignatureStatus>> = {
  PENDIENTE: 'PENDING',
  FIRMADA: 'SIGNED',
  VENCIDA: 'EXPIRED',
  FALLIDA: 'FAILED',
};

const date = (value: string | null): Date | null => (value ? new Date(value) : null);

export function toSubscription(dto: AssistedSubscriptionDto): AssistedSubscription {
  return {
    id: dto.id,
    quoteId: dto.cotizacion_id,
    client: dto.cliente && {
      name: dto.cliente.nombre,
      lastNameInitial: dto.cliente.inicial_apellido,
      documentType: dto.cliente.tipo_documento,
      maskedDocument: dto.cliente.documento_enmascarado,
    },
    productCode: dto.producto,
    insuredAmount: money(dto.monto_asegurado, dto.moneda),
    paymentFrequency: dto.periodicidad_pago,
    status: dto.estado_saga as SagaStatus,
    step: dto.paso_actual as SagaStep,
    steps: dto.pasos as SagaStep[],
    decision: dto.decision,
    chargeStatus: dto.cobro_estado,
    chargeReason: dto.cobro_motivo,
    signature: dto.firma && {
      status: SIGNATURE_STATUS[dto.firma.estado] ?? 'PENDING',
      expiresAt: date(dto.firma.vence_en),
    },
    compensation: dto.compensacion && {
      status: dto.compensacion.estado,
      reason: dto.compensacion.motivo,
      requestedAt: date(dto.compensacion.solicitada_en),
    },
    policy: dto.poliza && {
      number: dto.poliza.numero_poliza,
      status: dto.poliza.estado,
      documentStatus: dto.poliza.documento_estado,
    },
    canManageSignature: dto.puede_gestionar_firma,
    createdAt: new Date(dto.creada_en),
  };
}

export function toSubscriptionPage(dto: SubscriptionPageDto): SubscriptionPage {
  return {
    items: dto.items.map(toSubscription),
    total: dto.total,
    page: dto.pagina,
    size: dto.tamano,
  };
}

export function toSignatureDocument(dto: SignatureDocumentDto): SignatureDocument {
  return {
    policyNumber: dto.numero_poliza,
    hash: dto.documento_sha256,
    state: dto.estado === 'FIRMADA' ? 'SIGNED' : 'PENDING',
    expiresAt: date(dto.vence_en),
  };
}

export function toSignatureResult(dto: SignatureDto, replay: boolean): SignatureResult {
  return {
    status: dto.estado_saga as SagaStatus,
    signedAt: new Date(dto.firmada_en),
    replay,
  };
}

export function toStartBody(request: StartRequest): Record<string, unknown> {
  return {
    cotizacion_id: request.quoteId,
    metodo_pago: request.paymentToken,
    acepta_terminos: request.termsAccepted,
    periodicidad_pago: request.frequency,
  };
}

export function toSignBody(request: SignRequest): Record<string, unknown> {
  return {
    documento_sha256: request.hash,
    documento_revisado: request.reviewed,
    codigo: request.code,
  };
}
