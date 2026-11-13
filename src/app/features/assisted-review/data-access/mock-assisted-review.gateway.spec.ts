import { ApiError } from '@core/http/api-error';
import { firstValueFrom } from 'rxjs';
import { InboxQuery } from '../domain/models';
import { MockAssistedReviewGateway } from './mock-assisted-review.gateway';

const PENDING: InboxQuery = {
  state: 'PENDING',
  category: null,
  mineOnly: false,
  expiredOnly: false,
  page: 1,
};
const JUSTIFICATION = 'Se revisaron los soportes de ingresos.';

describe('MockAssistedReviewGateway', () => {
  let gateway: MockAssistedReviewGateway;

  beforeEach(() => (gateway = new MockAssistedReviewGateway()));

  it('should list the pending cases, the oldest first, and count the expired ones', async () => {
    const page = await firstValueFrom(gateway.listReviews(PENDING));

    expect(page.total).toBe(3);
    expect(page.expiredTotal).toBe(1);
    const times = page.items.map((c) => c.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('should filter the expired ones and by category', async () => {
    const expired = await firstValueFrom(gateway.listReviews({ ...PENDING, expiredOnly: true }));
    const amount = await firstValueFrom(
      gateway.listReviews({ ...PENDING, category: 'AMOUNT_OVER_LIMIT' }),
    );

    expect(expired.items.every((c) => c.quoteExpired)).toBeTrue();
    expect(amount.items.map((c) => c.categories)).toEqual([['AMOUNT_OVER_LIMIT']]);
  });

  it('should only allow rejecting an expired case, and refuse to approve it', async () => {
    const [expired] = (await firstValueFrom(gateway.listReviews({ ...PENDING, expiredOnly: true })))
      .items;
    const detail = await firstValueFrom(gateway.getReview(expired.id));

    expect(detail.allowedDecisions).toEqual(['REJECTED']);
    await expectAsync(
      firstValueFrom(
        gateway.decide(expired.id, {
          decision: 'APPROVED',
          justification: JUSTIFICATION,
          insuredAmount: null,
        }),
      ),
    ).toBeRejectedWith(jasmine.objectContaining({ code: 'COTIZACION_VENCIDA' }));
    const closed = await firstValueFrom(
      gateway.decide(expired.id, {
        decision: 'REJECTED',
        justification: JUSTIFICATION,
        insuredAmount: null,
      }),
    );
    expect(closed.state).toBe('DECIDED');
  });

  it('should decide a case once and answer 409 the second time', async () => {
    const [first] = (await firstValueFrom(gateway.listReviews(PENDING))).items;
    const request = {
      decision: 'APPROVED',
      justification: JUSTIFICATION,
      insuredAmount: null,
    } as const;

    const decided = await firstValueFrom(gateway.decide(first.id, request));

    expect(decided.human?.decision).toBe('APPROVED');
    expect(decided.canDecide).toBeFalse();
    await expectAsync(firstValueFrom(gateway.decide(first.id, request))).toBeRejectedWith(
      jasmine.objectContaining({ code: 'REVISION_YA_DECIDIDA', status: 409 }),
    );
    const pending = await firstValueFrom(gateway.listReviews(PENDING));
    const done = await firstValueFrom(gateway.listReviews({ ...PENDING, state: 'DECIDED' }));
    expect(pending.total).toBe(2);
    expect(done.items.map((c) => c.id)).toEqual([first.id]);
  });

  it('should scale the premiums when adjusting and refuse an amount that is not lower', async () => {
    const [first] = (await firstValueFrom(gateway.listReviews(PENDING))).items;
    const detail = await firstValueFrom(gateway.getReview(first.id));
    const current = detail.quote.insuredAmount.amount;

    await expectAsync(
      firstValueFrom(
        gateway.decide(first.id, {
          decision: 'ADJUSTED',
          justification: JUSTIFICATION,
          insuredAmount: current,
        }),
      ),
    ).toBeRejectedWith(jasmine.objectContaining({ code: 'AJUSTE_INVALIDO' }));
    const decided = await firstValueFrom(
      gateway.decide(first.id, {
        decision: 'ADJUSTED',
        justification: JUSTIFICATION,
        insuredAmount: current / 2,
      }),
    );

    expect(decided.human?.adjustment?.factor).toBe(0.5);
    expect(decided.human?.adjustment?.annualPremium).toBe(
      Math.round(detail.quote.annualPremium.amount / 2),
    );
  });

  it('should answer 404 for a case that does not exist', async () => {
    await expectAsync(firstValueFrom(gateway.getReview('nope'))).toBeRejectedWith(
      jasmine.any(ApiError),
    );
  });
});
