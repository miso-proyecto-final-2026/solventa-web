import {
  AbstractControl,
  FormControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FieldKind, FieldSpec } from '../domain/models';

const INTEGER = /^\d+$/;

const oneOf =
  (options: readonly string[]): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null =>
    !control.value || options.includes(control.value as string) ? null : { option: true };

const integerValidators = (spec: FieldSpec): ValidatorFn[] => [
  Validators.pattern(INTEGER),
  ...(spec.min !== null ? [Validators.min(spec.min)] : []),
  ...(spec.max !== null ? [Validators.max(spec.max)] : []),
];

const textValidators = (spec: FieldSpec): ValidatorFn[] =>
  spec.options ? [oneOf(spec.options)] : [];

type FieldBuilder = (spec: FieldSpec) => FormControl<string>;

/**
 * Estrategia por tipo de campo: cada tipo sabe armar su control y sus validaciones a partir de lo
 * que dice el catálogo. Un producto nuevo no toca los componentes; un tipo nuevo agrega una entrada.
 */
export const FIELD_BUILDERS: Record<FieldKind, FieldBuilder> = {
  integer: (spec) =>
    new FormControl('', {
      nonNullable: true,
      validators: [...(spec.required ? [Validators.required] : []), ...integerValidators(spec)],
    }),
  text: (spec) =>
    new FormControl('', {
      nonNullable: true,
      validators: [...(spec.required ? [Validators.required] : []), ...textValidators(spec)],
    }),
};
