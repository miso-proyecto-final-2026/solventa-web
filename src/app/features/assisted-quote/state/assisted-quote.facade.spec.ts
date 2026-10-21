import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { Subject } from 'rxjs';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { Quote } from '../domain/models';
import { FakeAssistedQuoteGateway } from '../testing/fake-assisted-quote.gateway';
import { CLIENT, QUOTE } from '../testing/fixtures';
import { AssistedQuoteFacade } from './assisted-quote.facade';
import { AssistedQuoteStore } from './assisted-quote.store';

describe('AssistedQuoteFacade', () => {
  let gateway: FakeAssistedQuoteGateway;
  let facade: AssistedQuoteFacade;
  let store: AssistedQuoteStore;
  const doc = { type: 'CC', number: '1000000001' } as const;

  beforeEach(() => {
    sessionStorage.clear();
    gateway = new FakeAssistedQuoteGateway();
    TestBed.configureTestingModule({
      providers: [
        AssistedQuoteStore,
        AssistedQuoteFacade,
        { provide: AssistedQuoteGateway, useValue: gateway },
      ],
    });
    facade = TestBed.inject(AssistedQuoteFacade);
    store = facade.store;
  });

  afterEach(() => sessionStorage.clear());

  it('should start at the document step', () => {
    expect(store.step()).toBe('lookup');
    expect(store.stepIndex()).toBe(0);
  });

  it('should find the client, load their profile and move to the profile step', () => {
    facade.searchClient(doc);

    expect(store.step()).toBe('profile');
    expect(store.client()).toBe(CLIENT);
    expect(store.profile()?.source).toBe('REAL');
    expect(store.clientNotFound()).toBeFalse();
    expect(store.busy()).toBeFalse();
  });

  it('should explain an unknown document at the profile step instead of failing', () => {
    gateway.client = null;

    facade.searchClient(doc);

    expect(store.step()).toBe('profile');
    expect(store.client()).toBeNull();
    expect(store.clientNotFound()).toBeTrue();
    expect(gateway.profileCalls).toBe(0);
    expect(store.error()).toBeNull();
  });

  it('should keep the step and expose the error when the search fails', () => {
    gateway.failFind = new ApiError('server', 500);

    facade.searchClient(doc);

    expect(store.step()).toBe('lookup');
    expect(store.error()?.kind).toBe('server');
    expect(store.busy()).toBeFalse();
  });

  it('should wrap an unexpected failure as a server error', () => {
    gateway.failFind = new Error('boom') as unknown as ApiError;

    facade.searchClient(doc);

    expect(store.error()?.kind).toBe('server');
  });

  it('should load the catalog once and go to the insurance step on approval', () => {
    facade.searchClient(doc);

    facade.approve();
    facade.goTo('profile');
    facade.approve();

    expect(store.step()).toBe('insurance');
    expect(store.catalog().length).toBe(2);
    expect(gateway.catalogCalls).toBe(1);
  });

  it('should quote an existing client by id', () => {
    facade.searchClient(doc);
    facade.approve();

    facade.requestQuote('microseguro_vida', { edad: 35, suma_asegurada: 50_000_000 });

    expect(gateway.quoted[0].subject).toEqual({ kind: 'client', clientId: CLIENT.id });
    expect(store.quote()).toBe(QUOTE);
    expect(store.step()).toBe('result');
  });

  it('should quote a prospect by document when the client does not exist', () => {
    gateway.client = null;
    facade.searchClient(doc);
    facade.approve();

    facade.requestQuote('microseguro_vida', { edad: 35, suma_asegurada: 50_000_000 });

    expect(gateway.quoted[0].subject).toEqual({ kind: 'prospect', document: doc });
  });

  it('should ignore a second submit while the first is still running', () => {
    facade.searchClient(doc);
    facade.approve();
    gateway.holdQuote = new Subject<Quote>();

    facade.requestQuote('microseguro_vida', { edad: 35 });
    facade.requestQuote('microseguro_vida', { edad: 35 });

    expect(gateway.quoted.length).toBe(1);
    expect(store.busy()).toBeTrue();

    gateway.holdQuote.next(QUOTE);
    gateway.holdQuote.complete();
    expect(store.busy()).toBeFalse();
    expect(store.step()).toBe('result');
  });

  it('should stay on the form and expose server field errors when the quote is rejected', () => {
    facade.searchClient(doc);
    facade.approve();
    gateway.failQuote = new ApiError('validation', 422, 'VALIDATION_ERROR', [
      { field: 'datos.edad', reason: 'debe ser mayor o igual a 18' },
    ]);

    facade.requestQuote('microseguro_vida', { edad: 5 });

    expect(store.step()).toBe('insurance');
    expect(store.fieldErrors()).toEqual({ edad: 'debe ser mayor o igual a 18' });
  });

  it('should clear the error when going back', () => {
    gateway.failFind = new ApiError('network', 0);
    facade.searchClient(doc);

    facade.goTo('lookup');

    expect(store.error()).toBeNull();
  });

  it('should do nothing without somebody to quote', () => {
    facade.requestQuote('microseguro_vida', {});

    expect(gateway.quoted.length).toBe(0);
  });

  it('should save the draft and drop it once the quote is delivered', () => {
    facade.saveDraft({
      documentType: 'CC',
      documentNumber: '1000000001',
      productCode: null,
      data: {},
    });
    expect(facade.loadDraft()?.documentNumber).toBe('1000000001');

    facade.searchClient(doc);
    facade.approve();
    facade.requestQuote('microseguro_vida', { edad: 35 });

    expect(facade.loadDraft()).toBeNull();
  });

  it('should reset everything for a new quote', () => {
    facade.searchClient(doc);
    facade.approve();
    facade.requestQuote('microseguro_vida', { edad: 35 });

    facade.newQuote();

    expect(store.step()).toBe('lookup');
    expect(store.client()).toBeNull();
    expect(store.quote()).toBeNull();
  });
});
