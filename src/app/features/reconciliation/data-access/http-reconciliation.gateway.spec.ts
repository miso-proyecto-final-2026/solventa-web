import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { apiErrorInterceptor } from '@core/http/interceptors';
import { NO_FILTERS } from '../domain/models';
import { DisbursementDto } from './dto/reconciliation.dto';
import { HttpReconciliationGateway } from './http-reconciliation.gateway';

const BASE = '/api/pagos/v1/pagos/conciliacion/desembolsos';

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
  numero_poliza: null,
  monto_asegurado: null,
  validacion: null,
  estado: 'PAGADA',
  monto: '5000000.00',
  moneda: 'COP',
  referencia_pasarela: 'simpg_abc',
  fecha_pago: '2026-11-10T08:31:00Z',
  intentos: 1,
  reentregas: 0,
  estado_conciliacion: 'PENDIENTE',
  conciliado_por: null,
  conciliado_en: null,
  diferencia: null,
  escalada_en: null,
  escalada_por: null,
  nota_escalamiento: null,
  codigo_fallo: null,
  motivo_fallo: null,
};

describe('HttpReconciliationGateway', () => {
  let gateway: HttpReconciliationGateway;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpReconciliationGateway,
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    gateway = TestBed.inject(HttpReconciliationGateway);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('should ask for a page with no filters when none is chosen', () => {
    let total = 0;
    gateway.list({ ...NO_FILTERS, page: 2 }).subscribe((p) => (total = p.total));

    const req = backend.expectOne((r) => r.url === BASE && r.method === 'GET');
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('tamano')).toBe('25');
    for (const name of ['desde', 'hasta', 'tipo_evento', 'estado_conciliacion']) {
      expect(req.request.params.has(name)).toBeFalse();
    }
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush({ items: [DTO], total: 26, pagina: 2, tamano: 25 });

    expect(total).toBe(26);
  });

  it('should send the filters with the names MS Pagos expects, the dates as instants', () => {
    gateway
      .list({
        from: '2026-11-01',
        to: '2026-11-10',
        eventType: 'sismo',
        reconciliation: 'WITH_DIFFERENCE',
        page: 1,
      })
      .subscribe();

    const req = backend.expectOne((r) => r.url === BASE);
    const p = req.request.params;
    expect(p.get('tipo_evento')).toBe('sismo');
    expect(p.get('estado_conciliacion')).toBe('CON_DIFERENCIA');
    expect(new Date(p.get('desde')!).getTime()).toBe(new Date('2026-11-01T00:00:00').getTime());
    expect(new Date(p.get('hasta')!).getTime()).toBe(new Date('2026-11-10T23:59:59.999').getTime());
    req.flush({ items: [], total: 0, pagina: 1, tamano: 25 });
  });

  it('should read the summary with the same filters', () => {
    let duplicates = -1;
    gateway
      .summary({ ...NO_FILTERS, eventType: 'sismo' })
      .subscribe((s) => (duplicates = s.keysWithMultiplePayments));

    const req = backend.expectOne((r) => r.url === `${BASE}/resumen`);
    expect(req.request.params.get('tipo_evento')).toBe('sismo');
    req.flush({
      desembolsos: 1,
      claves_distintas: 1,
      claves_con_mas_de_un_pago: 0,
      pagados: 1,
      monto_pagado: '5000000.00',
      por_estado_conciliacion: { PENDIENTE: 1, CONCILIADO: 0, CON_DIFERENCIA: 0 },
    });

    expect(duplicates).toBe(0);
  });

  it('should read the detail with its payment attempts, never from a cached copy', () => {
    let attempts = 0;
    gateway.get('ds 1').subscribe((d) => (attempts = d.paymentAttempts.length));

    const req = backend.expectOne(`${BASE}/ds%201`);
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush({
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
    });

    expect(attempts).toBe(1);
  });

  it('should reconcile with a POST and no body', () => {
    gateway.reconcile('ds-1').subscribe();

    const req = backend.expectOne(`${BASE}/ds-1/conciliar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({ ...DTO, estado_conciliacion: 'CONCILIADO', conciliado_por: 'Olga Operadora' });
  });

  it('should escalate with the note under the name MS Pagos expects', () => {
    let note: string | null = null;
    gateway.escalate('ds-1', 'revisar').subscribe((d) => (note = d.escalationNote));

    const req = backend.expectOne(`${BASE}/ds-1/escalar`);
    expect(req.request.body).toEqual({ nota: 'revisar' });
    req.flush({ ...DTO, nota_escalamiento: 'revisar' });

    expect(note as string | null).toBe('revisar');
  });

  it('should download the report as a file in the chosen format, with the filters', () => {
    let size = 0;
    gateway.export({ ...NO_FILTERS, eventType: 'sismo' }, 'pdf').subscribe((b) => (size = b.size));

    const req = backend.expectOne((r) => r.url === `${BASE}/exportar`);
    expect(req.request.params.get('formato')).toBe('pdf');
    expect(req.request.params.get('tipo_evento')).toBe('sismo');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(size).toBe(4);
  });

  it('should turn a 409 from Pagos into an ApiError with its code', () => {
    let error: ApiError | undefined;
    gateway.reconcile('ds-1').subscribe({ error: (e: ApiError) => (error = e) });

    backend
      .expectOne(`${BASE}/ds-1/conciliar`)
      .flush(
        { error: { code: 'EXTRACTO_SIN_PAGO', message: 'x', details: [], trace_id: 't' } },
        { status: 409, statusText: 'Conflict' },
      );

    expect(error?.code).toBe('EXTRACTO_SIN_PAGO');
  });
});
