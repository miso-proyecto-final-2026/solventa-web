import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuoteDraft } from '../domain/models';
import { CATALOG } from '../testing/fixtures';
import { ProductDraft, ProductForm, ProductSubmission } from './product-form';

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let el: HTMLElement;
  let submissions: ProductSubmission[];
  let drafts: ProductDraft[];
  let backs = 0;

  const field = (name: string) =>
    el.querySelector<HTMLInputElement | HTMLSelectElement>(`#insurance-${name}`)!;
  const setValue = (name: string, value: string) => {
    const control = field(name);
    control.value = value;
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const submit = async () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };
  const render = async (inputs: Record<string, unknown> = {}) => {
    fixture.componentRef.setInput('catalog', CATALOG);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    submissions = [];
    drafts = [];
    backs = 0;
    await TestBed.configureTestingModule({ imports: [ProductForm] }).compileComponents();
    fixture = TestBed.createComponent(ProductForm);
    fixture.componentInstance.submitQuote.subscribe((s) => submissions.push(s));
    fixture.componentInstance.draftChange.subscribe((d) => drafts.push(d));
    fixture.componentInstance.back.subscribe(() => backs++);
    el = fixture.nativeElement;
  });

  it('should build the form from the first product of the catalog', async () => {
    await render();

    const labels = Array.from(el.querySelectorAll('label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Producto', 'Edad', 'Suma asegurada']);
    expect(field('product').value).toBe('microseguro_vida');
  });

  it('should associate every label with its control', async () => {
    await render();

    for (const label of Array.from(el.querySelectorAll('label'))) {
      expect(el.querySelector(`#${label.getAttribute('for')}`)).not.toBeNull();
    }
  });

  it('should show the allowed range as help and link it to the control', async () => {
    await render();

    expect(el.querySelector('#insurance-edad-hint')?.textContent).toContain('18 – 65');
    expect(field('edad').getAttribute('aria-describedby')).toBe('insurance-edad-hint');
  });

  it('should rebuild the fields when the product changes', async () => {
    await render();

    setValue('product', 'proteccion_dispositivos');
    await fixture.whenStable();

    const labels = Array.from(el.querySelectorAll('label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Producto', 'Tipo de dispositivo', 'Valor del dispositivo']);
    const options = Array.from(field('tipo_dispositivo').querySelectorAll('option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['Selecciona una opción', 'Celular', 'Portátil', 'Tableta']);
  });

  it('should emit the product and numeric data when valid', async () => {
    await render();

    setValue('edad', '35');
    setValue('suma_asegurada', '50000000');
    await submit();

    expect(submissions).toEqual([
      { productCode: 'microseguro_vida', data: { edad: 35, suma_asegurada: 50_000_000 } },
    ]);
  });

  it('should show inline errors and an error summary, and not submit, when invalid', async () => {
    await render();

    setValue('edad', '5');
    await submit();

    expect(submissions).toEqual([]);
    expect(field('edad').getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#insurance-edad-error')?.textContent).toContain('menor que el mínimo');
    expect(el.querySelector('#insurance-suma_asegurada-error')?.textContent).toContain(
      'obligatorio',
    );
    const summary = el.querySelector('sol-error-summary [role="alert"]');
    expect(summary?.textContent).toContain('Revisa estos datos');
    expect(summary?.querySelectorAll('li').length).toBe(2);
  });

  it('should not lose what was typed after a failed submit', async () => {
    await render();

    setValue('edad', '5');
    await submit();

    expect(field('edad').value).toBe('5');
  });

  it('should mark the fields the server rejected', async () => {
    await render({ serverErrors: { edad: 'debe ser mayor o igual a 18' } });

    expect(el.querySelector('#insurance-edad-error')?.textContent).toContain(
      'no cumple las reglas del producto',
    );
    expect(field('edad').getAttribute('aria-invalid')).toBe('true');
  });

  it('should restore a draft: product and typed values', async () => {
    const draft: QuoteDraft = {
      documentType: 'CC',
      documentNumber: '1000000001',
      productCode: 'proteccion_dispositivos',
      data: { tipo_dispositivo: 'celular', valor_dispositivo: '2500000' },
    };

    await render({ initial: draft });

    expect(field('product').value).toBe('proteccion_dispositivos');
    expect(field('tipo_dispositivo').value).toBe('celular');
    expect(field('valor_dispositivo').value).toBe('2500000');
  });

  it('should fall back to the first product when the draft one no longer exists', async () => {
    await render({
      initial: {
        documentType: 'CC',
        documentNumber: '',
        productCode: 'desaparecido',
        data: { edad: '9' },
      },
    });

    expect(field('product').value).toBe('microseguro_vida');
    expect(field('edad').value).toBe('');
  });

  it('should report every change as a draft', async () => {
    await render();

    setValue('edad', '41');

    expect(drafts.at(-1)).toEqual({
      productCode: 'microseguro_vida',
      data: { edad: '41', suma_asegurada: '' },
    });
  });

  it('should block the button while busy and offer to go back', async () => {
    await render({ busy: true });

    const submitButton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBeTrue();
    expect(submitButton.textContent).toContain('Calculando');

    el.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(backs).toBe(1);
  });
});
