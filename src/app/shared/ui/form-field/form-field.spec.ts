import { TestBed } from '@angular/core/testing';
import { FormField, describedBy } from './form-field';

describe('FormField', () => {
  const render = async (inputs: Record<string, string | null>) => {
    const fixture = TestBed.createComponent(FormField);
    fixture.componentRef.setInput('fieldId', 'edad');
    fixture.componentRef.setInput('label', 'Edad');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('should tie the label to the control by id', async () => {
    const el = await render({});

    expect(el.querySelector('label')?.getAttribute('for')).toBe('edad');
    expect(el.querySelector('label')?.textContent).toBe('Edad');
  });

  it('should show nothing extra when there is no hint or error', async () => {
    const el = await render({});

    expect(el.querySelector('small')).toBeNull();
  });

  it('should render the hint and the error with the ids that aria-describedby points to', async () => {
    const el = await render({ hint: 'Entre 18 y 65', error: 'Es obligatorio' });

    expect(el.querySelector('#edad-hint')?.textContent).toContain('Entre 18 y 65');
    expect(el.querySelector('#edad-error')?.textContent).toContain('Es obligatorio');
  });

  it('should build aria-describedby from what is present', () => {
    expect(describedBy('edad', false, false)).toBeNull();
    expect(describedBy('edad', true, false)).toBe('edad-hint');
    expect(describedBy('edad', false, true)).toBe('edad-error');
    expect(describedBy('edad', true, true)).toBe('edad-hint edad-error');
  });
});
