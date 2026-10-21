import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorSummary } from './error-summary';

@Component({
  imports: [ErrorSummary],
  template: `
    <sol-error-summary [errors]="errors" heading="Revisa estos datos" />
    <input id="edad" />
  `,
})
class Host {
  errors = [{ fieldId: 'edad', message: 'Edad: es obligatoria' }];
  readonly summary = viewChild.required(ErrorSummary);
}

describe('ErrorSummary', () => {
  const create = async (errors?: Host['errors']) => {
    const fixture = TestBed.createComponent(Host);
    if (errors) fixture.componentInstance.errors = errors;
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    return fixture;
  };

  it('should render nothing without errors', async () => {
    const fixture = await create([]);

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    fixture.nativeElement.remove();
  });

  it('should announce the heading and list each error as a link to its field', async () => {
    const fixture = await create();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"] h2')?.textContent).toBe('Revisa estos datos');
    expect(el.querySelector('li a')?.getAttribute('href')).toBe('#edad');
    el.remove();
  });

  it('should move the focus to the field when its link is used', async () => {
    const fixture = await create();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('li a')!.click();

    expect(document.activeElement?.id).toBe('edad');
    fixture.nativeElement.remove();
  });

  it('should be able to take the focus itself, for the screen reader to announce it', async () => {
    const fixture = await create();

    fixture.componentInstance.summary().focus();

    expect(document.activeElement?.tagName).toBe('H2');
    fixture.nativeElement.remove();
  });
});
