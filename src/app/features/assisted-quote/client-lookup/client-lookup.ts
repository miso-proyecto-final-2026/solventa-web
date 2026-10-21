import { Component, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { describedBy, FormField } from '@shared/ui/form-field/form-field';
import {
  DOCUMENT_NUMBER_PATTERN,
  DOCUMENT_TYPES,
  DocumentId,
  DocumentType,
} from '../domain/models';

/** Valida el formato sin contar los espacios de los extremos, que se descartan al buscar. */
const documentNumberFormat = (control: AbstractControl): ValidationErrors | null =>
  DOCUMENT_NUMBER_PATTERN.test(String(control.value).trim()) ? null : { pattern: true };

/** Paso 1: el asesor escribe el documento del cliente. */
@Component({
  selector: 'sol-client-lookup',
  imports: [ReactiveFormsModule, FormField],
  templateUrl: './client-lookup.html',
})
export class ClientLookup {
  readonly busy = input(false);
  /** Documento a precargar (borrador recuperado). */
  readonly initial = input<DocumentId | null>(null);

  readonly lookup = output<DocumentId>();
  readonly draftChange = output<DocumentId>();

  protected readonly types = DOCUMENT_TYPES;
  protected readonly describedBy = describedBy;
  protected readonly submitted = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['CC' as DocumentType],
    number: ['', [Validators.required, documentNumberFormat]],
  });

  constructor() {
    effect(() => {
      const initial = this.initial();
      if (initial) this.form.setValue({ type: initial.type, number: initial.number });
    });
    this.form.valueChanges.subscribe(() => {
      const { type, number } = this.form.getRawValue();
      this.draftChange.emit({ type, number });
    });
  }

  protected numberError(): string | null {
    const control = this.form.controls.number;
    if (!control.invalid || !(control.touched || this.submitted())) return null;
    return control.hasError('required')
      ? $localize`:@@assistedQuote.lookup.number.required:Escribe el número de documento.`
      : $localize`:@@assistedQuote.lookup.number.invalid:El número debe tener entre 5 y 15 letras o dígitos, sin espacios ni puntos.`;
  }

  protected submit(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { type, number } = this.form.getRawValue();
    this.lookup.emit({ type, number: number.trim() });
  }
}
