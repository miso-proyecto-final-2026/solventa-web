import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentId } from '../domain/models';
import { ClientLookup } from './client-lookup';

describe('ClientLookup', () => {
  let fixture: ComponentFixture<ClientLookup>;
  let el: HTMLElement;
  let searched: DocumentId[];
  let drafts: DocumentId[];

  const input = () => el.querySelector<HTMLInputElement>('#lookup-number')!;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ClientLookup] }).compileComponents();
    fixture = TestBed.createComponent(ClientLookup);
    searched = [];
    drafts = [];
    fixture.componentInstance.lookup.subscribe((d) => searched.push(d));
    fixture.componentInstance.draftChange.subscribe((d) => drafts.push(d));
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('should label both controls', () => {
    expect(el.querySelector('label[for="lookup-type"]')?.textContent).toContain(
      'Tipo de documento',
    );
    expect(el.querySelector('label[for="lookup-number"]')?.textContent).toContain(
      'Número de documento',
    );
  });

  it('should offer the three document types', () => {
    const options = Array.from(el.querySelectorAll('#lookup-type option')).map(
      (o) => o.textContent,
    );

    expect(options).toEqual(['CC', 'CE', 'PASAPORTE']);
  });

  it('should emit the document when valid', async () => {
    type(' 1000000001 ');
    await submit();

    expect(searched).toEqual([{ type: 'CC', number: '1000000001' }]);
  });

  it('should show an inline error and not search when the number is empty', async () => {
    await submit();

    expect(searched).toEqual([]);
    expect(el.querySelector('#lookup-number-error')?.textContent).toContain(
      'Escribe el número de documento',
    );
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe('lookup-number-error');
  });

  it('should explain the accepted format when the number is malformed', async () => {
    type('12 3');
    await submit();

    expect(searched).toEqual([]);
    expect(el.querySelector('#lookup-number-error')?.textContent).toContain('entre 5 y 15');
  });

  it('should disable the button and say it is busy while searching', async () => {
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBeTrue();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Buscando');
  });

  it('should report what is typed as a draft and restore an initial document', async () => {
    type('55667788');
    expect(drafts.at(-1)).toEqual({ type: 'CC', number: '55667788' });

    fixture.componentRef.setInput('initial', { type: 'CE', number: '99887766' });
    await fixture.whenStable();

    expect(input().value).toBe('99887766');
    expect(el.querySelector<HTMLSelectElement>('#lookup-type')!.value).toBe('CE');
  });
});
