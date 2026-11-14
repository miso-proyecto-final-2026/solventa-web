import { ApiError } from '@core/http/api-error';
import {
  componentLabel,
  consentEffect,
  coverageLabel,
  dataTypeLabel,
  errorMessage,
  fieldLabel,
  lineageSourceLabel,
  missingReasonLabel,
  optionLabel,
  originLabel,
  productLabel,
  profileFieldLabel,
  signalLabel,
  ttlLabel,
} from './labels';

describe('assisted quote labels', () => {
  it('should translate the known codes', () => {
    expect(productLabel('microseguro_vida')).toBe('Microseguro de vida');
    expect(fieldLabel('suma_asegurada')).toBe('Suma asegurada');
    expect(optionLabel('portatil')).toBe('Portátil');
    expect(coverageLabel('robo')).toBe('Robo');
    expect(componentLabel('recargo_degradado')).toBe('Recargo por datos no disponibles');
    expect(signalLabel('ratio_endeudamiento')).toBe('Nivel de endeudamiento');
  });

  it('should show an unknown code as it is, so a new product does not break the screen', () => {
    expect(productLabel('hogar')).toBe('hogar');
    expect(productLabel('hogar', 'Seguro de hogar')).toBe('Seguro de hogar');
    expect(fieldLabel('metros')).toBe('metros');
    expect(coverageLabel('incendio')).toBe('incendio');
  });

  it('should give a different message to each kind of failure', () => {
    const kinds = ['network', 'forbidden', 'validation', 'unauthenticated', 'server'] as const;
    const messages = kinds.map((k) => errorMessage(new ApiError(k, 0)));

    expect(new Set(messages).size).toBe(kinds.length);
    expect(errorMessage(new ApiError('not-found', 404))).toBe(
      errorMessage(new ApiError('server', 500)),
    );
  });

  it('should explain how each profile source affects the price', () => {
    expect(consentEffect('REAL')).toContain('perfil real');
    expect(consentEffect('DEFAULT')).toContain('estimado');
    expect(consentEffect('DEGRADED')).toContain('recargo');
  });

  it('should translate the lineage codes and show unknown ones as they come (HU24)', () => {
    expect(lineageSourceLabel('open_finance')).toBe('Open Finance');
    expect(lineageSourceLabel('fuente_nueva')).toBe('fuente_nueva');
    expect(profileFieldLabel('score_crediticio')).toBe('Puntaje crediticio');
    expect(missingReasonLabel('sin_datos')).toBe('La fuente no estaba disponible');
    expect(dataTypeLabel('SOCIOECONOMIC')).toBe('Socioeconómico');
    expect(originLabel('DEFAULT')).toBe('Por defecto: fuente no disponible');
  });

  it('should show the cache validity in hours when exact and in minutes otherwise', () => {
    expect(ttlLabel(3600)).toBe('1 h');
    expect(ttlLabel(86400)).toBe('24 h');
    expect(ttlLabel(900)).toBe('15 min');
    expect(ttlLabel(null)).toBe('—');
  });
});
