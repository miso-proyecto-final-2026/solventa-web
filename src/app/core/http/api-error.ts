import { HttpErrorResponse } from '@angular/common/http';

/** Tipo de fallo que le importa a la pantalla, sin importar qué servicio respondió. */
export type ApiErrorKind =
  'validation' | 'unauthenticated' | 'forbidden' | 'not-found' | 'server' | 'network';

export interface FieldError {
  readonly field: string;
  readonly reason: string;
}

/** Error del backend ya normalizado. El texto para el usuario sale de recursos por idioma, no de aquí. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly code: string | null = null,
    readonly fields: readonly FieldError[] = [],
  ) {
    super(`${kind} (${status}${code ? ` ${code}` : ''})`);
    this.name = 'ApiError';
  }
}

interface CotizacionErrorBody {
  error?: { code?: string; details?: { campo?: string; motivo?: string }[] };
}

interface IdentidadErrorBody {
  detail?: string | { loc?: (string | number)[]; msg?: string }[];
}

function kindOf(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status >= 400 && status < 500) return 'validation';
  return 'server';
}

/**
 * Cotización responde `{ error: { code, details: [{ campo, motivo }] } }` e Identidad `{ detail }`.
 * Este adaptador es el único lugar que conoce las dos formas.
 */
export function toApiError(response: HttpErrorResponse): ApiError {
  const body: unknown = response.error;
  const kind = kindOf(response.status);

  const cotizacion = (body as CotizacionErrorBody | null)?.error;
  if (cotizacion && typeof cotizacion === 'object') {
    const fields = (cotizacion.details ?? [])
      .filter((d) => d.campo)
      .map((d) => ({ field: d.campo ?? '', reason: d.motivo ?? '' }));
    return new ApiError(kind, response.status, cotizacion.code ?? null, fields);
  }

  const detail = (body as IdentidadErrorBody | null)?.detail;
  if (Array.isArray(detail)) {
    const fields = detail.map((d) => ({
      field: (d.loc ?? []).filter((p) => p !== 'query' && p !== 'body').join('.'),
      reason: d.msg ?? '',
    }));
    return new ApiError(kind, response.status, null, fields);
  }
  return new ApiError(kind, response.status);
}
