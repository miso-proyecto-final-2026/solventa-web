import { Page, Route } from '@playwright/test';
import {
  ADVISOR,
  CATALOG_DTO,
  CLIENTS,
  PROFILE_DTO,
  SEARCH_DTO,
  SESSION_DTO,
  quoteDto,
} from './fixtures';

/** Un fallo que se inyecta en la siguiente llamada: una respuesta HTTP o una caída de red. */
export type Failure = { status: number; body?: unknown } | 'network';

const IDENTIDAD = '/api/identidad/v1';
const COTIZACION = '/api/cotizacion/v1';

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
