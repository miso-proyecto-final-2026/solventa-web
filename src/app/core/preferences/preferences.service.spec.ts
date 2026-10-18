import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(PreferencesService);
  });

  afterEach(() => localStorage.clear());

  it('should have no language until the user chooses one', () => {
    expect(service.getLanguage()).toBeNull();
  });

  it('should remember the chosen language', () => {
    service.setLanguage('en-US');

    expect(service.getLanguage()).toBe('en-US');
  });

  it('should ignore a stored value that is not a supported language', () => {
    localStorage.setItem('solventa.language', 'fr-FR');

    expect(service.getLanguage()).toBeNull();
  });

  it('should keep working when storage is blocked', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');

    expect(() => service.setLanguage('en-US')).not.toThrow();
    expect(service.getLanguage()).toBeNull();
  });
});
