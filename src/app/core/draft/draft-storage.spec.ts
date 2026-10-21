import { TestBed } from '@angular/core/testing';
import { DraftStorage } from './draft-storage';

describe('DraftStorage', () => {
  let drafts: DraftStorage;

  beforeEach(() => {
    sessionStorage.clear();
    drafts = TestBed.inject(DraftStorage);
  });

  afterEach(() => sessionStorage.clear());

  it('should give back what was saved', () => {
    drafts.save('quote', { number: '1000000001', data: { edad: '35' } });

    expect(drafts.load('quote')).toEqual({ number: '1000000001', data: { edad: '35' } });
  });

  it('should return null when nothing was saved or after clearing', () => {
    expect(drafts.load('quote')).toBeNull();

    drafts.save('quote', { a: 1 });
    drafts.clear('quote');

    expect(drafts.load('quote')).toBeNull();
  });

  it('should keep drafts of different forms apart', () => {
    drafts.save('one', 1);
    drafts.save('two', 2);

    expect(drafts.load('one')).toBe(1);
    expect(drafts.load('two')).toBe(2);
  });

  it('should ignore a corrupt entry', () => {
    sessionStorage.setItem('solventa.draft.quote', 'no es json');

    expect(drafts.load('quote')).toBeNull();
  });

  it('should not fail when the storage is blocked', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('bloqueado');
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    spyOn(Storage.prototype, 'removeItem').and.throwError('bloqueado');

    expect(() => drafts.save('quote', 1)).not.toThrow();
    expect(drafts.load('quote')).toBeNull();
    expect(() => drafts.clear('quote')).not.toThrow();
  });
});
