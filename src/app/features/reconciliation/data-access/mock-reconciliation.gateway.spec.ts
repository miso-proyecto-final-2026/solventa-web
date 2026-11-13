import { firstValueFrom } from 'rxjs';
import { NO_FILTERS } from '../domain/models';
import { MockReconciliationGateway } from './mock-reconciliation.gateway';

describe('MockReconciliationGateway', () => {
  let gateway: MockReconciliationGateway;
  const all = async () => (await firstValueFrom(gateway.list({ ...NO_FILTERS, page: 1 }))).items;
  const byType = async (type: string) => (await all()).find((d) => d.eventType === type)!;

  beforeEach(() => (gateway = new MockReconciliationGateway()));

  it('should filter by event type and by reconciliation status', async () => {
    const floods = await firstValueFrom(
      gateway.list({ ...NO_FILTERS, eventType: 'inundacion', page: 1 }),
    );
    const reconciled = await firstValueFrom(
      gateway.list({ ...NO_FILTERS, reconciliation: 'RECONCILED', page: 1 }),
    );

    expect(floods.items.map((d) => d.eventType)).toEqual(['inundacion']);
    expect(reconciled.items.every((d) => d.reconciliation === 'RECONCILED')).toBeTrue();
    expect(reconciled.total).toBeGreaterThan(0);
  });

  it('should summarize with no key paid twice', async () => {
    const s = await firstValueFrom(gateway.summary(NO_FILTERS));

    expect(s.keysWithMultiplePayments).toBe(0);
    expect(s.distinctKeys).toBe(s.disbursements);
    expect(
      s.byReconciliation.PENDING +
        s.byReconciliation.RECONCILED +
        s.byReconciliation.WITH_DIFFERENCE,
    ).toBe(s.disbursements);
  });

  it('should reconcile when the statement matches, leaving who and when', async () => {
    const pending = (await all()).find(
      (d) => d.reconciliation === 'PENDING' && d.eventType === 'sismo',
    )!;

    const done = await firstValueFrom(gateway.reconcile(pending.id));

    expect(done.reconciliation).toBe('RECONCILED');
    expect(done.reconciledBy).toBeTruthy();
    expect(done.reconciledAt).toBeInstanceOf(Date);
  });

  it('should leave a difference when the statement amount differs, and allow escalating it', async () => {
    const flood = await byType('inundacion');

    const done = await firstValueFrom(gateway.reconcile(flood.id));
    expect(done.reconciliation).toBe('WITH_DIFFERENCE');
    expect(done.difference?.gatewayAmount.amount).toBeLessThan(done.amount.amount);

    const escalated = await firstValueFrom(gateway.escalate(flood.id, '  revisar  '));
    expect(escalated.escalationNote).toBe('revisar');
  });

  it('should refuse to reconcile a payment the statement does not have, and a failed one', async () => {
    const missing = await byType('vuelo_retrasado');
    const failed = await byType('sequia');

    await expectAsync(firstValueFrom(gateway.reconcile(missing.id))).toBeRejectedWithError(/409/);
    await expectAsync(firstValueFrom(gateway.reconcile(failed.id))).toBeRejectedWithError(/409/);
    expect((await byType('vuelo_retrasado')).reconciliation).toBe('PENDING');
  });

  it('should only escalate what has a difference, with a note of 1 to 500 characters', async () => {
    const pending = (await all()).find((d) => d.reconciliation === 'PENDING')!;
    const withDifference = await byType('vuelo_cancelado');

    await expectAsync(firstValueFrom(gateway.escalate(pending.id, 'nota'))).toBeRejectedWithError(
      /409/,
    );
    await expectAsync(
      firstValueFrom(gateway.escalate(withDifference.id, '   ')),
    ).toBeRejectedWithError(/422/);
    await expectAsync(
      firstValueFrom(gateway.escalate(withDifference.id, 'x'.repeat(501))),
    ).toBeRejectedWithError(/422/);
  });

  it('should answer 404 for an unknown disbursement', async () => {
    await expectAsync(firstValueFrom(gateway.get('no-existe'))).toBeRejectedWithError(/404/);
    await expectAsync(firstValueFrom(gateway.reconcile('no-existe'))).toBeRejectedWithError(/404/);
  });

  it('should export a CSV and a PDF', async () => {
    const csv = await firstValueFrom(gateway.export(NO_FILTERS, 'csv'));
    const pdf = await firstValueFrom(gateway.export(NO_FILTERS, 'pdf'));

    expect(csv.type).toBe('text/csv');
    expect(await csv.text()).toContain('Evento,Tipo de evento');
    expect(pdf.type).toBe('application/pdf');
  });
});
