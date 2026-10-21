import { TestBed } from '@angular/core/testing';
import { Alert, AlertKind } from './alert';

describe('Alert', () => {
  const render = async (kind: AlertKind) => {
    const fixture = TestBed.createComponent(Alert);
    fixture.componentRef.setInput('kind', kind);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('.alert') as HTMLElement;
  };

  it('should announce errors right away', async () => {
    expect((await render('error')).getAttribute('role')).toBe('alert');
  });

  it('should announce the other kinds politely', async () => {
    for (const kind of ['info', 'success', 'warning'] as const) {
      expect((await render(kind)).getAttribute('role'))
        .withContext(kind)
        .toBe('status');
    }
  });

  it('should not rely on color alone: each kind has its own icon, hidden from screen readers', async () => {
    const icons = new Set<string>();
    for (const kind of ['info', 'success', 'warning', 'error'] as const) {
      const icon = (await render(kind)).querySelector('.alert__icon')!;
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      icons.add(icon.textContent ?? '');
    }
    expect(icons.size).toBe(4);
  });
});
