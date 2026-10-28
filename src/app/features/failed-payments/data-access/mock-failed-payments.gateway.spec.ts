import { ApiError } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { MockFailedPaymentsGateway } from './mock-failed-payments.gateway';

describe('MockFailedPaymentsGateway', () => {
  let gateway: MockFailedPaymentsGateway;

  beforeEach(() => (gateway = new MockFailedPaymentsGateway()));

  it('should list the open cases, the most urgent first', async () => {
    const page = await firstValueFrom(
      gateway.listCases({ status: 'OPEN', dueSoonOnly: false, page: 1 }),
    );

    expect(page.total).toBe(3);
    const times = page.items.map((c) => c.graceUntil.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('should keep only the due-soon or overdue cases with that filter', async () => {
    const page = await firstValueFrom(
      gateway.listCases({ status: 'OPEN', dueSoonOnly: true, page: 1 }),
    );

    expect(page.items.every((c) => c.grace === 'DUE_SOON' || c.grace === 'OVERDUE')).toBeTrue();
  });

  it('should recover a case once and answer a repeated key without charging again', async () => {
    const [first] = (
      await firstValueFrom(gateway.listCases({ status: 'PENDING', dueSoonOnly: true, page: 1 }))
    ).items;

    const result = await firstValueFrom(gateway.retry(first.id, 'k1'));
    const again = await firstValueFrom(gateway.retry(first.id, 'k1'));

    expect(result.outcome).toBe('APPROVED');
    expect(again.replay).toBeTrue();
    expect((await firstValueFrom(gateway.getCase(first.id))).retries).toBe(1);
    await expectAsync(firstValueFrom(gateway.retry(first.id, 'k2'))).toBeRejectedWith(
      jasmine.objectContaining({ code: 'CASO_YA_RECUPERADO' }),
    );
  });

  it('should reject a note with a card number and keep the rest', async () => {
    const id = (
      await firstValueFrom(gateway.listCases({ status: 'OPEN', dueSoonOnly: false, page: 1 }))
    ).items[0].id;

    await expectAsync(
      firstValueFrom(gateway.addNote(id, 'paga con 4111 1111 1111 1111')),
    ).toBeRejectedWith(jasmine.any(ApiError));
    await firstValueFrom(gateway.addNote(id, 'Llamar mañana'));

    expect((await firstValueFrom(gateway.getCase(id))).notes.map((n) => n.text)).toEqual([
      'Llamar mañana',
    ]);
  });
});
