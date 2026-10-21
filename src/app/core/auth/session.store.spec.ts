import { TestBed } from '@angular/core/testing';
import { Session, SessionStore } from './session.store';

const session = (expiresInMs = 60_000, role = 'ASESOR'): Session => ({
  token: 'tok',
  user: { id: 'u1', name: 'Asesora Demo', role },
  expiresAt: Date.now() + expiresInMs,
});

describe('SessionStore', () => {
  const create = () => TestBed.inject(SessionStore);

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('should start without a session', () => {
    const store = create();

    expect(store.isAuthenticated()).toBeFalse();
    expect(store.user()).toBeNull();
    expect(store.token()).toBeNull();
    expect(store.expired()).toBeFalse();
  });

  it('should expose the user, role and token once started', () => {
    const store = create();

    store.start(session());

    expect(store.user()?.name).toBe('Asesora Demo');
    expect(store.hasRole('ASESOR')).toBeTrue();
    expect(store.hasRole('AUDITOR')).toBeFalse();
    expect(store.token()).toBe('tok');
  });

  it('should treat a token past its expiry as an expired session', () => {
    const store = create();
    store.start(session(-1));

    expect(store.isActive()).toBeFalse();
    expect(store.token()).toBeNull();
    expect(store.expired()).toBeTrue();
  });

  it('should tell a voluntary sign-out from an expiry', () => {
    const store = create();
    store.start(session());

    store.end();

    expect(store.isAuthenticated()).toBeFalse();
    expect(store.expired()).toBeFalse();
  });

  it('should clear the expired flag when a new session starts', () => {
    const store = create();
    store.start(session());
    store.expire();
    expect(store.expired()).toBeTrue();

    store.start(session());

    expect(store.expired()).toBeFalse();
    expect(store.isAuthenticated()).toBeTrue();
  });

  it('should survive a reload (kept in sessionStorage) while it is still valid', () => {
    create().start(session());
    TestBed.resetTestingModule();

    expect(create().user()?.id).toBe('u1');
  });

  it('should not restore a session that already expired or a corrupt entry', () => {
    sessionStorage.setItem('solventa.session', JSON.stringify(session(-1000)));
    expect(create().isAuthenticated()).toBeFalse();

    TestBed.resetTestingModule();
    sessionStorage.setItem('solventa.session', '{no es json');
    expect(create().isAuthenticated()).toBeFalse();
  });

  it('should keep working in memory when the storage is blocked', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('bloqueado');
    const store = create();

    store.start(session());

    expect(store.isAuthenticated()).toBeTrue();
  });
});
