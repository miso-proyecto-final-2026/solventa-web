import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { apiErrorInterceptor } from '@core/http/interceptors';
import { ProfileLevels, ReviewDetail, ReviewPage } from '../domain/models';
import { HttpAssistedReviewGateway } from './http-assisted-review.gateway';

const BASE = '/api/suscripcion/v1/suscripciones/revisiones';

const DETAIL_BODY = {
  id: 'sus-1',
  cliente_id: 'cli-1',
  cliente: null,
  cotizacion: {
    cotizacion_id: 'cot-1',
    producto: 'microseguro_vida',
    moneda: 'COP',
    monto_asegurado: 40_000_000,
    prima_mensual: 14_583,
    prima_anual: 175_000,
    periodicidad_pago: 'ANUAL',
    coberturas: [],
    vigente_hasta: null,
  },
  decision_automatica: { motivos: [], reglas_version: null, decidido_en: null },
  decision_humana: null,
  prioridad: 'BAJA',
  estado: 'PENDIENTE',
  creada_en: '2026-11-09T08:00:00Z',
  cotizacion_vencida: false,
  puede_decidir: true,
  decisiones_permitidas: ['APROBADA', 'RECHAZADA', 'AJUSTADA'],
};

describe('HttpAssistedReviewGateway', () => {
  let gateway: HttpAssistedReviewGateway;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpAssistedReviewGateway,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    gateway = TestBed.inject(HttpAssistedReviewGateway);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('should ask Suscripción for the pending cases, without a stale copy', () => {
    let page: ReviewPage | undefined;
    gateway
      .listReviews({
        state: 'PENDING',
        category: null,
        mineOnly: false,
        expiredOnly: false,
        page: 2,
      })
      .subscribe((p) => (page = p));

    const req = backend.expectOne((r) => r.url === BASE && r.method === 'GET');
    expect(req.request.params.get('estado')).toBe('PENDIENTE');
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('tamano')).toBe('20');
    expect(req.request.params.has('mias')).toBeFalse();
    expect(req.request.params.has('vencidas')).toBeFalse();
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush({ items: [], total: 0, total_vencidas: 4, pagina: 2, tamano: 20 });

    expect(page?.expiredTotal).toBe(4);
  });

  it('should send the filters in use', () => {
    gateway
      .listReviews({
        state: 'DECIDED',
        category: 'AMOUNT_OVER_LIMIT',
        mineOnly: true,
        expiredOnly: true,
        page: 1,
      })
      .subscribe();

    const req = backend.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('estado')).toBe('DECIDIDA');
    expect(req.request.params.get('categoria')).toBe('MONTO_SOBRE_LIMITE');
    expect(req.request.params.get('mias')).toBe('true');
    expect(req.request.params.get('vencidas')).toBe('true');
    req.flush({ items: [], total: 0, total_vencidas: 0, pagina: 1, tamano: 20 });
  });

  it('should read one case and map it', () => {
    let detail: ReviewDetail | undefined;
    gateway.getReview('sus 1').subscribe((d) => (detail = d));

    const req = backend.expectOne(`${BASE}/sus%201`);
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush(DETAIL_BODY);

    expect(detail?.canDecide).toBeTrue();
    expect(detail?.allowedDecisions).toEqual(['APPROVED', 'REJECTED', 'ADJUSTED']);
  });

  it('should read the profile levels of the client from Cotización', () => {
    let profile: ProfileLevels | undefined;
    gateway.getProfile('cli-1').subscribe((p) => (profile = p));

    backend.expectOne('/api/cotizacion/v1/asesor/clientes/cli-1/perfil').flush({
      cliente_id: 'cli-1',
      con_consentimiento: true,
      perfil_fuente: 'REAL',
      fuentes: [],
      completitud: 1,
      senales: [{ nombre: 'reportes_negativos', nivel: 'BAJO' }],
      obtenido_en: '2026-11-09T08:00:00Z',
    });

    expect(profile?.signals).toEqual([{ name: 'reportes_negativos', level: 'LOW' }]);
  });

  it('should post the decision in the backend shape', () => {
    gateway
      .decide('sus-1', {
        decision: 'ADJUSTED',
        justification: ' Texto de la justificación. ',
        insuredAmount: 30_000_000,
      })
      .subscribe();

    const req = backend.expectOne(`${BASE}/sus-1/decision`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      decision: 'AJUSTADA',
      justificacion: 'Texto de la justificación.',
      monto_asegurado: 30_000_000,
    });
    req.flush(DETAIL_BODY);
  });

  it('should surface a second decision as 409 with who and when', () => {
    let error: ApiError | undefined;
    gateway
      .decide('sus-1', {
        decision: 'APPROVED',
        justification: 'Texto de la justificación.',
        insuredAmount: null,
      })
      .subscribe({ error: (e: ApiError) => (error = e) });

    backend.expectOne(`${BASE}/sus-1/decision`).flush(
      {
        error: {
          code: 'REVISION_YA_DECIDIDA',
          message: 'Otro asesor ya decidió este caso.',
          details: [{ campo: 'asesor', motivo: 'Laura Gómez' }],
          trace_id: 't',
        },
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(error?.code).toBe('REVISION_YA_DECIDIDA');
    expect(error?.status).toBe(409);
    expect(error?.fields).toEqual([{ field: 'asesor', reason: 'Laura Gómez' }]);
  });
});
