import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { MockAssistedQuoteGateway } from './mock-assisted-quote.gateway';

describe('MockAssistedQuoteGateway', () => {
  let gateway: MockAssistedQuoteGateway;
  const vida = { edad: 35, suma_asegurada: 50_000_000 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockAssistedQuoteGateway] });
    gateway = TestBed.inject(MockAssistedQuoteGateway);
  });

  const find = (number: string) => firstValueFrom(gateway.findClient({ type: 'CC', number }));
  const quoteFor = async (number: string) => {
    const client = await find(number);
    return firstValueFrom(
      gateway.requestQuote({
        subject: { kind: 'client', clientId: client!.id },
        productCode: 'microseguro_vida',
        data: vida,
      }),
    );
  };
  const failure = async (promise: Promise<unknown>) =>
    (await promise.catch((e: unknown) => e)) as ApiError;

  it('should know the five demo clients and not others', async () => {
    for (const n of ['1000000001', '1000000002', '1000000003', '1000000004', '1000000005']) {
      expect(await find(n)).not.toBeNull();
    }
    expect(await find('99999999')).toBeNull();
  });

  it('should reproduce the consent states of the backend seed', async () => {
    expect((await find('1000000001'))?.consent.state).toBe('GRANTED');
    expect((await find('1000000004'))?.consent.state).toBe('REVOKED');
    expect((await find('1000000005'))?.consent.state).toBe('NOT_GRANTED');
  });

  it('should price the demo profiles like the engine: favorable < neutral < risky', async () => {
    const [favorable, neutral, risky] = await Promise.all([
      quoteFor('1000000001'),
      quoteFor('1000000003'),
      quoteFor('1000000002'),
    ]);

    expect(neutral.annualPremium.amount).toBe(175_000);
    expect(favorable.annualPremium.amount).toBe(157_938);
    expect(risky.annualPremium.amount).toBe(276_719);
    expect(favorable.estimated).toBeFalse();
  });

  it('should quote revoked clients and prospects with the default profile, as an estimate', async () => {
    const revoked = await quoteFor('1000000004');
    const prospect = await firstValueFrom(
      gateway.requestQuote({
        subject: { kind: 'prospect', document: { type: 'CC', number: '99999999' } },
        productCode: 'microseguro_vida',
        data: vida,
      }),
    );

    expect(revoked.annualPremium.amount).toBe(175_000);
    expect(revoked.estimated).toBeTrue();
    expect(prospect.estimated).toBeTrue();
    expect(prospect.withoutAccount).toBeTrue();
  });

  it('should return a breakdown that adds up to the annual premium', async () => {
    const quote = await quoteFor('1000000002');

    const total = quote.components.reduce((sum, c) => sum + c.amount.amount, 0);
    expect(total).toBe(quote.annualPremium.amount);
  });

  it('should reject out-of-range data with the same field errors as the server', async () => {
    const client = await find('1000000001');

    const error = await failure(
      firstValueFrom(
        gateway.requestQuote({
          subject: { kind: 'client', clientId: client!.id },
          productCode: 'microseguro_vida',
          data: { edad: 5, suma_asegurada: 200_000_000 },
        }),
      ),
    );

    expect(error.kind).toBe('validation');
    expect(error.fields.map((f) => f.field)).toEqual(['datos.edad', 'datos.suma_asegurada']);
  });

  it('should reject an unknown product and quote devices too', async () => {
    const unknown = await failure(
      firstValueFrom(
        gateway.requestQuote({
          subject: { kind: 'prospect', document: { type: 'CC', number: '1' } },
          productCode: 'nada',
          data: {},
        }),
      ),
    );
    expect(unknown.kind).toBe('validation');

    const device = await firstValueFrom(
      gateway.requestQuote({
        subject: { kind: 'prospect', document: { type: 'CC', number: '99999999' } },
        productCode: 'proteccion_dispositivos',
        data: { tipo_dispositivo: 'celular', valor_dispositivo: 2_500_000, antiguedad_meses: 8 },
      }),
    );
    expect(device.coverages.map((c) => c.type)).toEqual(['dano_accidental', 'robo']);
  });

  it('should give signals only to clients with consent, and a catalog of two products', async () => {
    const granted = await find('1000000002');
    const revoked = await find('1000000004');

    const risky = await firstValueFrom(gateway.getProfile(granted!.id));
    const noConsent = await firstValueFrom(gateway.getProfile(revoked!.id));
    const catalog = await firstValueFrom(gateway.getCatalog());

    expect(risky.source).toBe('REAL');
    expect(risky.signals.map((s) => s.level)).toEqual(['HIGH', 'MEDIUM', 'HIGH']);
    expect(noConsent.source).toBe('DEFAULT');
    expect(noConsent.signals).toEqual([]);
    expect(catalog.map((p) => p.code)).toEqual(['microseguro_vida', 'proteccion_dispositivos']);
  });
});
