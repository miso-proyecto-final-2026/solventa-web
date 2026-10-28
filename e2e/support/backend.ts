import { Page, Route } from '@playwright/test';
import {
  ADVISOR,
  CATALOG_DTO,
  CLIENTS,
  PROFILE_DTO,
  SEARCH_DTO,
  SESSION_DTO,
  FailedCaseDto,
  failedCaseDetail,
  failedCases,
  quoteDto,
  RetryChargeDto,
} from './fixtures';

/** Un fallo que se inyecta en la siguiente llamada: una respuesta HTTP o una caída de red. */
export type Failure = { status: number; body?: unknown } | 'network';

const IDENTIDAD = '/api/identidad/v1';
const COTIZACION = '/api/cotizacion/v1';
const COBROS_FALLIDOS = '/api/pagos/v1/pagos/cobros-fallidos';

/** Respuesta de la pasarela al próximo reintento (HU19). */
export type RetryMode = 'APROBADO' | 'RECHAZADO' | 'NO_DISPONIBLE';

/** 401 con el cuerpo que usa cada servicio: así los tests pasan por el normalizador real. */
export const UNAUTHENTICATED: Failure = {
  status: 401,
  body: {
    error: {
      code: 'NO_AUTENTICADO',
      message: 'La sesión no es válida o venció.',
      details: [],
      trace_id: 't',
    },
  },
};

export const SERVER_ERROR: Failure = {
  status: 500,
  body: {
    error: { code: 'ERROR_INTERNO', message: 'Error interno.', details: [], trace_id: 't' },
  },
};

export const VALIDATION_ERROR: Failure = {
  status: 422,
  body: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'La solicitud no es válida.',
      details: [{ campo: 'datos.edad', motivo: 'debe ser mayor o igual a 18' }],
      trace_id: 't',
    },
  },
};

/**
 * Backend simulado con `page.route`. Cada llamada del recorrido se responde con los fixtures del
 * contrato; lo que no esté simulado se anota en `unhandled` (el fixture de prueba falla si queda algo).
 */
export class Backend {
  readonly searched: string[] = [];
  readonly quoteRequests: Record<string, unknown>[] = [];
  readonly unhandled: string[] = [];
  /** HU19: casos de cobro fallido, notas guardadas y la `Idempotency-Key` de cada reintento. */
  cases: FailedCaseDto[] = failedCases();
  readonly notes: Record<string, unknown[]> = {};
  readonly retryKeys: string[] = [];
  /** Cargos de reintento por caso; el de la pasarela caída queda `PENDIENTE` hasta `resolvePendingRetry`. */
  readonly retryCharges: Record<string, RetryChargeDto[]> = {};
  retryMode: RetryMode = 'APROBADO';
  private nextCasesFailure: Failure | null = null;

  private nextSearchFailure: Failure | null = null;
  private nextQuoteFailure: Failure | null = null;

  constructor(private readonly page: Page) {}

  /** La siguiente búsqueda de cliente falla así. */
  failNextSearch(failure: Failure): void {
    this.nextSearchFailure = failure;
  }

  /** La siguiente cotización falla así. */
  failNextQuote(failure: Failure): void {
    this.nextQuoteFailure = failure;
  }

  /** La siguiente consulta de la bandeja o del detalle falla así. */
  failNextCases(failure: Failure): void {
    this.nextCasesFailure = failure;
  }

  async install(): Promise<void> {
    // Las rutas registradas después tienen prioridad: esta, la más general, va primero.
    await this.page.route(/\/api\//, (route) => {
      this.unhandled.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 501, json: {} });
    });

    await this.page.route(new RegExp(`${IDENTIDAD}/sesiones-internas$`), (route) => {
      const body = route.request().postDataJSON() as { email?: string; password?: string };
      const valid = body.email === ADVISOR.email && body.password === ADVISOR.password;
      return valid
        ? route.fulfill({ json: SESSION_DTO })
        : route.fulfill({ status: 401, json: { detail: 'Correo o contraseña incorrectos' } });
    });

    await this.page.route(new RegExp(`${IDENTIDAD}/clientes/busqueda`), (route) =>
      this.respond(route, this.takeSearchFailure(), () => {
        const document = new URL(route.request().url()).searchParams.get('numero_documento') ?? '';
        this.searched.push(document);
        const client = CLIENTS[document];
        return client
          ? route.fulfill({ json: SEARCH_DTO(document, client) })
          : route.fulfill({ status: 404, json: { detail: 'Cliente no encontrado' } });
      }),
    );

    await this.page.route(new RegExp(`${COTIZACION}/asesor/clientes/([^/]+)/perfil$`), (route) => {
      const id = /clientes\/([^/]+)\/perfil/.exec(route.request().url())?.[1];
      const client = Object.values(CLIENTS).find((c) => c.id === id);
      return client
        ? route.fulfill({ json: PROFILE_DTO(client) })
        : route.fulfill({ status: 404, json: { error: { code: 'NO_ENCONTRADO' } } });
    });

    await this.page.route(new RegExp(`${COTIZACION}/productos$`), (route) =>
      route.fulfill({ json: CATALOG_DTO }),
    );

    await this.page.route(new RegExp(`${COTIZACION}/asesor/cotizaciones$`), (route) =>
      this.respond(route, this.takeQuoteFailure(), () => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        this.quoteRequests.push(body);
        const client = Object.values(CLIENTS).find((c) => c.id === body['cliente_id']) ?? null;
        return route.fulfill({ status: 201, json: quoteDto(client, 'documento' in body) });
      }),
    );

    await this.installFailedPayments();
  }

  private async installFailedPayments(): Promise<void> {
    await this.page.route(new RegExp(`${COBROS_FALLIDOS}(\\?.*)?$`), (route) =>
      this.respond(route, this.takeCasesFailure(), () => {
        const params = new URL(route.request().url()).searchParams;
        const estado = params.get('estado');
        const items = this.cases.filter((c) =>
          estado ? c.estado === estado : c.estado !== 'RECUPERADO',
        );
        return route.fulfill({
          json: {
            items,
            total: items.length,
            pagina: Number(params.get('pagina') ?? 1),
            tamano: 20,
          },
        });
      }),
    );

    await this.page.route(new RegExp(`${COBROS_FALLIDOS}/([^/?]+)$`), (route) =>
      this.respond(route, this.takeCasesFailure(), () => {
        const id = decodeURIComponent(/cobros-fallidos\/([^/?]+)/.exec(route.request().url())![1]);
        const found = this.cases.find((c) => c.id === id);
        return found
          ? route.fulfill({
              json: failedCaseDetail(found, this.notes[id] ?? [], this.retryCharges[id]),
            })
          : route.fulfill({ status: 404, json: pagosError('CASO_NO_ENCONTRADO') });
      }),
    );

    await this.page.route(new RegExp(`${COBROS_FALLIDOS}/([^/]+)/notas$`), (route) => {
      const id = /cobros-fallidos\/([^/]+)\/notas/.exec(route.request().url())![1];
      const texto = (route.request().postDataJSON() as { texto: string }).texto;
      if (/(?:\d[ -]?){12,18}\d/.test(texto)) {
        return route.fulfill({ status: 422, json: pagosError('DATO_DE_TARJETA_NO_PERMITIDO') });
      }
      const note = {
        id: (this.notes[id]?.length ?? 0) + 1,
        autor_id: 'a-1',
        autor_nombre: 'Asesora Demo',
        autor_rol: 'ASESOR',
        texto,
        creada_en: new Date().toISOString(),
      };
      this.notes[id] = [...(this.notes[id] ?? []), note];
      return route.fulfill({ status: 201, json: note });
    });

    await this.page.route(new RegExp(`${COBROS_FALLIDOS}/([^/]+)/reintentar$`), (route) => {
      const id = /cobros-fallidos\/([^/]+)\/reintentar/.exec(route.request().url())![1];
      this.retryKeys.push(route.request().headers()['idempotency-key'] ?? '');
      const found = this.cases.find((c) => c.id === id)!;
      const approved = this.retryMode === 'APROBADO';
      const declined = this.retryMode === 'RECHAZADO';
      if (approved) Object.assign(found, { estado: 'RECUPERADO', estado_gracia: null });
      found.intentos += 1;
      this.retryCharges[id] = [
        ...(this.retryCharges[id] ?? []),
        {
          transaccion_id: `${id}-r${found.intentos}`,
          estado: approved ? 'APROBADA' : declined ? 'RECHAZADA' : 'PENDIENTE',
          resultado: this.retryMode,
          fecha: new Date().toISOString(),
        },
      ];
      return route.fulfill({
        status: approved || declined ? 200 : 202,
        json: {
          caso_id: id,
          transaccion_id: `${id}-r${found.intentos}`,
          numero_reintento: found.intentos - 1,
          resultado: approved ? 'APROBADO' : declined ? 'RECHAZADO' : 'EN_PROCESO',
          codigo_rechazo: declined ? 'FONDOS_INSUFICIENTES' : null,
          motivo_rechazo: declined ? 'Fondos insuficientes' : null,
          detalle_pasarela: approved || declined ? null : 'NO_DISPONIBLE',
          estado_caso: found.estado,
          repeticion: false,
        },
      });
    });
  }

  /** Pagos termina el reintento que estaba en curso (la pasarela volvió y lo rechazó). */
  resolvePendingRetry(caseId: string): void {
    for (const charge of this.retryCharges[caseId] ?? []) {
      if (charge.estado === 'PENDIENTE') charge.estado = 'RECHAZADA';
    }
  }

  private takeCasesFailure(): Failure | null {
    const failure = this.nextCasesFailure;
    this.nextCasesFailure = null;
    return failure;
  }

  private takeSearchFailure(): Failure | null {
    const failure = this.nextSearchFailure;
    this.nextSearchFailure = null;
    return failure;
  }

  private takeQuoteFailure(): Failure | null {
    const failure = this.nextQuoteFailure;
    this.nextQuoteFailure = null;
    return failure;
  }

  private respond(route: Route, failure: Failure | null, ok: () => Promise<void>): Promise<void> {
    if (failure === 'network') return route.abort('failed');
    if (failure) return route.fulfill({ status: failure.status, json: failure.body ?? {} });
    return ok();
  }
}

function pagosError(code: string): unknown {
  return { error: { code, message: code, details: [], trace_id: 't' } };
}
