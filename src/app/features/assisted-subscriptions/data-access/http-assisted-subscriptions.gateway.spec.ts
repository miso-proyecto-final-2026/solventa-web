import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HASH } from '../testing/fixtures';
import { AssistedSubscriptionDto } from './dto/assisted-subscriptions.dto';
import { HttpAssistedSubscriptionsGateway } from './http-assisted-subscriptions.gateway';

const BASE = '/api/suscripcion/v1/suscripciones/asistidas';

const DTO: AssistedSubscriptionDto = {
  id: 'sus-1',
  cotizacion_id: 'cot-1',
  cliente: {
    nombre: 'Ana',
    inicial_apellido: 'P',
    tipo_documento: 'CC',
    documento_enmascarado: '******300',
  },
  producto: 'microseguro_vida',
  moneda: 'COP',
  monto_asegurado: 40000000,
  periodicidad_pago: 'ANUAL',
  estado_saga: 'COBRO_REALIZADO',
  paso_actual: 'FIRMA',
  pasos: ['DECISION', 'COBRO', 'FIRMA', 'EMISION'],
  decision: 'APROBADA',
  motivos: [],
  cobro_estado: 'APROBADO',
  cobro_motivo: null,
  firma: { estado: 'FALLIDA', vence_en: '2026-11-01T12:00:00Z', compensacion: 'SOLICITADA' },
  compensacion: {
    estado: 'SOLICITADA',
    motivo: 'FIRMA_FALLIDA',
    solicitada_en: '2026-10-30T12:00:00Z',
  },
  poliza: {
    numero_poliza: 'SOLV-1',
    estado: 'PENDIENTE_FIRMA',
    documento_estado: 'GENERADO',
    documento_intentos: 1,
    documento_error: null,
  },
  puede_gestionar_firma: false,
  creada_en: '2026-10-30T12:00:00Z',
};

describe('HttpAssistedSubscriptionsGateway', () => {
  let gateway: HttpAssistedSubscriptionsGateway;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpAssistedSubscriptionsGateway,
      ],
    });
    gateway = TestBed.inject(HttpAssistedSubscriptionsGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should start with the token, the declaration and the idempotency key', () => {
    let id = '';
    gateway
      .start(
        { quoteId: 'cot-1', paymentToken: 'tok_sim_x', frequency: 'MENSUAL', termsAccepted: true },
        'clave-1',
      )
      .subscribe((v) => (id = v));

    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-1');
    expect(req.request.body).toEqual({
      cotizacion_id: 'cot-1',
      metodo_pago: 'tok_sim_x',
      acepta_terminos: true,
      periodicidad_pago: 'MENSUAL',
    });
    req.flush({ id: 'sus-1' });
    expect(id).toBe('sus-1');
  });

  it('should list without a status filter and map the saga', () => {
    let client = '';
    let compensation = '';
    gateway.list({ status: 'ALL', page: 2 }).subscribe((p) => {
      client = p.items[0].client?.maskedDocument ?? '';
      compensation = p.items[0].compensation?.reason ?? '';
      expect(p.items[0].signature?.status).toBe('FAILED');
      expect(p.items[0].canManageSignature).toBeFalse();
      expect(p.items[0].insuredAmount.currency).toBe('COP');
      expect(p.total).toBe(1);
    });

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.has('estado')).toBeFalse();
    expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
    req.flush({ items: [DTO], total: 1, pagina: 2, tamano: 20 });
    expect(client).toBe('******300');
    expect(compensation).toBe('FIRMA_FALLIDA');
  });

  it('should send the status filter and tolerate empty parts of the saga', () => {
    gateway.list({ status: 'EMITIDA', page: 1 }).subscribe((p) => {
      expect(p.items[0].client).toBeNull();
      expect(p.items[0].signature).toBeNull();
      expect(p.items[0].compensation).toBeNull();
      expect(p.items[0].policy).toBeNull();
    });

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('estado')).toBe('EMITIDA');
    req.flush({
      items: [{ ...DTO, cliente: null, firma: null, compensacion: null, poliza: null }],
      total: 1,
      pagina: 1,
      tamano: 20,
    });
  });

  it('should escape the id in the detail', () => {
    gateway.get('a/b').subscribe();
    http.expectOne(`${BASE}/a%2Fb`).flush(DTO);
  });

  it('should read the document to sign', () => {
    gateway.getSignatureDocument('sus-1').subscribe((d) => {
      expect(d.hash).toBe(HASH);
      expect(d.state).toBe('PENDING');
    });

    http.expectOne(`${BASE}/sus-1/documento-firma`).flush({
      suscripcion_id: 'sus-1',
      numero_poliza: 'SOLV-1',
      documento_sha256: HASH,
      estado: 'PENDIENTE',
      vence_en: null,
      autenticacion: 'OTP',
    });
  });

  it('should ask for the code and read the PDFs as files', () => {
    gateway.requestCode('sus-1').subscribe();
    gateway.getSignaturePdf('sus-1').subscribe();
    gateway.downloadSignedPolicy('sus-1').subscribe();

    http.expectOne({ url: `${BASE}/sus-1/firma/codigo`, method: 'POST' }).flush(null);
    const pdf = http.expectOne(`${BASE}/sus-1/documento-firma/pdf`);
    const signed = http.expectOne(`${BASE}/sus-1/firma/documento`);
    expect(pdf.request.responseType).toBe('blob');
    expect(signed.request.responseType).toBe('blob');
    pdf.flush(new Blob());
    signed.flush(new Blob());
  });

  it('should sign and detect a repeated signature', () => {
    const replays: boolean[] = [];
    const request = { hash: HASH, reviewed: true, code: '123456' };
    gateway.sign('sus-1', request).subscribe((r) => replays.push(r.replay));
    gateway.sign('sus-1', request).subscribe((r) => replays.push(r.replay));

    const [first, second] = http.match(`${BASE}/sus-1/firma`);
    expect(first.request.body).toEqual({
      documento_sha256: HASH,
      documento_revisado: true,
      codigo: '123456',
    });
    const body = { estado_saga: 'EMITIDA', firmada_en: '2026-10-30T12:00:00Z' };
    first.flush(body);
    second.flush(body, { headers: { 'Idempotent-Replay': 'true' } });
    expect(replays).toEqual([false, true]);
  });
});
