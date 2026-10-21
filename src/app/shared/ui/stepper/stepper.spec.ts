import { TestBed } from '@angular/core/testing';
import { Stepper } from './stepper';

describe('Stepper', () => {
  const render = async (current: number) => {
    const fixture = TestBed.createComponent(Stepper);
    fixture.componentRef.setInput('steps', ['Uno', 'Dos', 'Tres']);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('label', 'Progreso');
    fixture.componentRef.setInput('doneLabel', 'Completado');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('should be a labelled list with one item per step', async () => {
    const el = await render(0);

    expect(el.querySelector('ol')?.getAttribute('aria-label')).toBe('Progreso');
    expect(el.querySelectorAll('li').length).toBe(3);
  });

  it('should mark only the current step with aria-current', async () => {
    const el = await render(1);

    const current = el.querySelectorAll('[aria-current="step"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain('Dos');
  });

  it('should tell screen readers which steps are done, not only show a check', async () => {
    const el = await render(2);

    const items = Array.from(el.querySelectorAll('li'));
    for (const item of items.slice(0, 2)) {
      expect(item.querySelector('.sol-visually-hidden')?.textContent).toContain('Completado');
    }
    expect(items[2].querySelector('.sol-visually-hidden')).toBeNull();
  });
});
