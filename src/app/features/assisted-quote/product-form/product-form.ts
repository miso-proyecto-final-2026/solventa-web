import { formatNumber } from '@angular/common';
import {
  Component,
  Injector,
  LOCALE_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describedBy, FormField } from '@shared/ui/form-field/form-field';
import { ErrorSummary, SummaryError } from '@shared/ui/error-summary/error-summary';
import { fieldLabel, optionLabel, productLabel } from '../domain/labels';
import { FieldSpec, Product, QuoteData, QuoteDraft } from '../domain/models';
import { FIELD_BUILDERS } from './field-builders';

export interface ProductSubmission {
  readonly productCode: string;
  readonly data: QuoteData;
}

export interface ProductDraft {
  readonly productCode: string | null;
  readonly data: Record<string, string>;
}

/** Paso 3: producto y datos del seguro. El formulario se arma desde el catálogo del backend. */
@Component({
  selector: 'sol-product-form',
  imports: [ReactiveFormsModule, FormField, ErrorSummary],
  templateUrl: './product-form.html',
})
export class ProductForm {
  readonly catalog = input.required<readonly Product[]>();
  readonly busy = input(false);
  /** Errores de validación del servidor por nombre de campo. */
  readonly serverErrors = input<Readonly<Record<string, string>>>({});
  /** Borrador recuperado (producto y datos escritos antes de que venciera la sesión). */
  readonly initial = input<QuoteDraft | null>(null);

  readonly submitQuote = output<ProductSubmission>();
  readonly back = output<void>();
  readonly draftChange = output<ProductDraft>();

  private readonly locale = inject(LOCALE_ID);
  private readonly summary = viewChild(ErrorSummary);
  private readonly injector = inject(Injector);

  protected readonly productControl = new FormControl<string>('', { nonNullable: true });
  protected readonly dataForm = signal(new FormGroup<Record<string, FormControl<string>>>({}));
  protected readonly submitted = signal(false);
  protected readonly describedBy = describedBy;
  protected readonly fieldLabel = fieldLabel;
  protected readonly optionLabel = optionLabel;
  protected readonly productLabel = productLabel;

  protected readonly product = signal<Product | null>(null);

  protected readonly summaryErrors = computed<SummaryError[]>(() => {
    this.submitted(); // se recalcula al enviar
    const product = this.product();
    return product
      ? product.fields
          .filter((f) => this.fieldError(f))
          .map((f) => ({
            fieldId: this.idOf(f),
            message: `${fieldLabel(f.name)}: ${this.fieldError(f)}`,
          }))
      : [];
  });

  constructor() {
    // Con el catálogo (y el borrador, si hay) se elige el producto y se arma el formulario.
    effect(() => {
      const catalog = this.catalog();
      const code = this.initial()?.productCode ?? catalog[0]?.code ?? '';
      if (code && !this.product()) this.select(code, this.initial()?.data ?? {});
    });
    this.productControl.valueChanges.subscribe((code) => this.select(code, {}));
  }

  protected idOf(field: FieldSpec): string {
    return `insurance-${field.name}`;
  }

  /** Rango permitido como ayuda; los números se formatean con el idioma del build. */
  protected hintOf(field: FieldSpec): string | null {
    if (field.kind !== 'integer' || field.min === null || field.max === null) return null;
    const min = formatNumber(field.min, this.locale, '1.0-0');
    const max = formatNumber(field.max, this.locale, '1.0-0');
    return `${$localize`:@@assistedQuote.form.range:Rango permitido`}: ${min} – ${max}`;
  }

  /** Mensaje de un campo: el del servidor, o el de la validación local tras tocarlo o enviar. */
  protected fieldError(field: FieldSpec): string | null {
    if (this.serverErrors()[field.name]) {
      return $localize`:@@assistedQuote.form.error.server:El valor no cumple las reglas del producto.`;
    }
    const control = this.dataForm().controls[field.name];
    if (!control?.invalid || !(control.touched || this.submitted())) return null;
    if (control.hasError('required'))
      return $localize`:@@assistedQuote.form.error.required:Este dato es obligatorio.`;
    if (control.hasError('pattern'))
      return $localize`:@@assistedQuote.form.error.integer:Escribe solo números enteros, sin puntos ni comas.`;
    if (control.hasError('min'))
      return $localize`:@@assistedQuote.form.error.min:El valor es menor que el mínimo permitido.`;
    if (control.hasError('max'))
      return $localize`:@@assistedQuote.form.error.max:El valor es mayor que el máximo permitido.`;
    return $localize`:@@assistedQuote.form.error.option:Elige una de las opciones.`;
  }

  protected submit(event: Event): void {
    // El formulario no usa NgForm: sin esto el navegador recargaría la página al enviar.
    event.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    const product = this.product();
    const form = this.dataForm();
    if (!product) return;
    if (form.invalid) {
      form.markAllAsTouched();
      // Tras pintar el resumen, el foco va a él para que el lector de pantalla lo anuncie.
      afterNextRender(() => this.summary()?.focus(), { injector: this.injector });
      return;
    }
    const data: Record<string, number | string> = {};
    for (const field of product.fields) {
      const raw = form.controls[field.name].value.trim();
      data[field.name] = field.kind === 'integer' ? Number(raw) : raw;
    }
    this.submitQuote.emit({ productCode: product.code, data });
  }

  private select(code: string, values: Record<string, string>): void {
    const found = this.catalog().find((p) => p.code === code);
    // Un código que ya no está en el catálogo (borrador viejo) cae al primer producto, sin datos.
    const product = found ?? this.catalog()[0] ?? null;
    if (!found) values = {};
    code = product?.code ?? '';
    this.product.set(product);
    this.submitted.set(false);
    this.productControl.setValue(code, { emitEvent: false });
    const group = new FormGroup<Record<string, FormControl<string>>>({});
    for (const field of product?.fields ?? []) {
      const control = FIELD_BUILDERS[field.kind](field);
      control.setValue(values[field.name] ?? '', { emitEvent: false });
      group.addControl(field.name, control);
    }
    group.valueChanges.subscribe(() =>
      this.draftChange.emit({ productCode: code, data: group.getRawValue() }),
    );
    this.dataForm.set(group);
    this.draftChange.emit({ productCode: code || null, data: group.getRawValue() });
  }
}
