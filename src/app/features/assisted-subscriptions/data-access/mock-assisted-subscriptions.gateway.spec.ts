import { firstValueFrom } from 'rxjs';
import { ApiError } from '@core/http/api-error';
import { MockAssistedSubscriptionsGateway } from './mock-assisted-subscriptions.gateway';

describe('MockAssistedSubscriptionsGateway', () => {
  let gateway: MockAssistedSubscriptionsGateway;
  const signable = async () => {
    const { items } = await firstValueFrom(gateway.list({ status: 'COBRO_REALIZADO', page: 1 }));
    return items[0].id;
  };
  const sign = (id: string, code: string) =>
    firstValueFrom(gateway.sign(id, { hash: 'a', reviewed: true, code }));

  beforeEach(() => (gateway = new MockAssistedSubscriptionsGateway()));

  it('should issue with the demo code', async () => {
    const id = await signable();

    expect((await sign(id, '123456')).status).toBe('EMITIDA');
    const after = await firstValueFrom(gateway.get(id));
    expect(after.status).toBe('EMITIDA');
    expect(after.canManageSignature).toBeFalse();
  });

  it('should fail after running out of codes', async () => {
    const id = await signable();

    await expectAsync(sign(id, '0')).toBeRejectedWith(
      new ApiError('forbidden', 403, 'OTP_INVALIDO', [
        { field: 'codigo', reason: 'intentos restantes: 2' },
      ]),
    );
    await expectAsync(sign(id, '0')).toBeRejected();
    await expectAsync(sign(id, '0')).toBeRejectedWith(
      new ApiError('validation', 409, 'FIRMA_FALLIDA'),
    );
  });

  it('should repeat the same saga with the same key', async () => {
    const request = {
      quoteId: 'cot',
      paymentToken: 'tok',
      frequency: 'ANUAL',
      termsAccepted: true,
    } as const;

    const first = await firstValueFrom(gateway.start(request, 'k'));
    const second = await firstValueFrom(gateway.start(request, 'k'));

    expect(second).toBe(first);
    expect((await firstValueFrom(gateway.get(first))).quoteId).toBe('cot');
  });

  it('should answer not found and serve the PDFs', async () => {
    const id = await signable();

    await expectAsync(firstValueFrom(gateway.get('x'))).toBeRejected();
    await expectAsync(firstValueFrom(gateway.getSignatureDocument('x'))).toBeRejected();
    await expectAsync(firstValueFrom(gateway.requestCode('x'))).toBeRejected();
    expect((await firstValueFrom(gateway.getSignatureDocument(id))).state).toBe('PENDING');
    expect((await firstValueFrom(gateway.getSignaturePdf(id))).type).toBe('application/pdf');
    expect((await firstValueFrom(gateway.downloadSignedPolicy(id))).type).toBe('application/pdf');
    await firstValueFrom(gateway.requestCode(id));
  });
});
