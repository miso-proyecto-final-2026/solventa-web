import { FieldSpec } from '../domain/models';
import { FIELD_BUILDERS } from './field-builders';

const integer = (over: Partial<FieldSpec> = {}): FieldSpec => ({
  name: 'edad',
  kind: 'integer',
  required: true,
  min: 18,
  max: 65,
  options: null,
  ...over,
});

describe('FIELD_BUILDERS', () => {
  describe('integer', () => {
    const build = (over?: Partial<FieldSpec>) => FIELD_BUILDERS.integer(integer(over));

    it('should require a value when the field is required', () => {
      expect(build().hasError('required')).toBeTrue();
      expect(build({ required: false }).valid).toBeTrue();
    });

    it('should accept whole numbers inside the range, borders included', () => {
      const control = build();
      for (const value of ['18', '35', '65']) {
        control.setValue(value);
        expect(control.valid).withContext(value).toBeTrue();
      }
    });

    it('should reject values outside the range', () => {
      const control = build();
      control.setValue('17');
      expect(control.hasError('min')).toBeTrue();
      control.setValue('66');
      expect(control.hasError('max')).toBeTrue();
    });

    it('should reject decimals, separators and letters', () => {
      const control = build();
      for (const value of ['35.5', '35,5', '1.000', 'abc', '-3']) {
        control.setValue(value);
        expect(control.hasError('pattern')).withContext(value).toBeTrue();
      }
    });

    it('should not bound a field without limits', () => {
      const control = build({ min: null, max: null });
      control.setValue('999999999');
      expect(control.valid).toBeTrue();
    });
  });

  describe('text', () => {
    const build = (options: readonly string[] | null) =>
      FIELD_BUILDERS.text({
        name: 'tipo',
        kind: 'text',
        required: true,
        min: null,
        max: null,
        options,
      });

    it('should only accept one of the listed options', () => {
      const control = build(['celular', 'portatil']);
      control.setValue('celular');
      expect(control.valid).toBeTrue();
      control.setValue('reloj');
      expect(control.hasError('option')).toBeTrue();
    });

    it('should accept any text when there is no list, but still require it', () => {
      const control = build(null);
      expect(control.hasError('required')).toBeTrue();
      control.setValue('lo que sea');
      expect(control.valid).toBeTrue();
    });
  });
});
