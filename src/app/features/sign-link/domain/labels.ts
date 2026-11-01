import { ApiError } from '@core/http/api-error';

/** Sin token, o con uno que ya no sirve: nada más se puede hacer en esta página. */
export function linkClosedMessage(error: ApiError | null): string | null {
  if (!error)
    return $localize`:@@sign-link.error.invalid:Este enlace no es válido. Pídele a tu asesor uno nuevo.`;
  switch (error.code) {
    case 'ENLACE_INVALIDO':
      return $localize`:@@sign-link.error.invalid:Este enlace no es válido. Pídele a tu asesor uno nuevo.`;
    case 'ENLACE_VENCIDO':
      return $localize`:@@sign-link.error.expired:Este enlace venció. Pídele a tu asesor uno nuevo.`;
    case 'ENLACE_REEMPLAZADO':
      return $localize`:@@sign-link.error.replaced:Este enlace fue reemplazado. Usa el más reciente que recibiste en tu correo.`;
    case 'FIRMA_VENCIDA':
      return $localize`:@@sign-link.error.signature-expired:El plazo para firmar terminó y el cobro se devolverá. Puedes volver a cotizar con tu asesor.`;
    case 'FIRMA_FALLIDA':
      return $localize`:@@sign-link.error.signature-failed:No se pudo verificar tu identidad y el cobro se devolverá. Puedes volver a cotizar con tu asesor.`;
    case 'FIRMA_NO_DISPONIBLE':
      return $localize`:@@sign-link.error.unavailable:Esta póliza ya no se puede firmar con este enlace. Consulta con tu asesor.`;
  }
  // El PDF se pide como `Blob`: su error no trae el código del backend, solo el estado HTTP.
  if (error.status === 401) {
    return $localize`:@@sign-link.error.invalid:Este enlace no es válido. Pídele a tu asesor uno nuevo.`;
  }
  if (error.status === 410) {
    return $localize`:@@sign-link.error.gone:Este enlace ya no sirve. Usa el más reciente que recibiste o pídele uno nuevo a tu asesor.`;
  }
  return null;
}

/** Se puede seguir: cada mensaje dice qué hacer. */
export function retryMessage(error: ApiError): string {
  if (error.code === 'OTP_INVALIDO') {
    const left = /\d+/.exec(error.fields.find((f) => f.field === 'codigo')?.reason ?? '')?.[0];
    return left === undefined
      ? $localize`:@@sign-link.error.otp:El código no es correcto. Si se agotan los intentos, la firma falla y se devuelve el cobro.`
      : $localize`:@@sign-link.error.otp-left:El código no es correcto. Intentos restantes: ${left}:left:. Si se agotan, la firma falla y se devuelve el cobro.`;
  }
  if (error.code === 'DOCUMENTO_ALTERADO') {
    return $localize`:@@sign-link.error.altered:El documento cambió. Ábrelo de nuevo y revísalo antes de firmar.`;
  }
  if (error.code === 'POLIZA_NO_LISTA') {
    return $localize`:@@sign-link.error.not-ready:El documento aún no está listo. Inténtalo de nuevo en unos minutos.`;
  }
  if (error.kind === 'network') {
    return $localize`:@@sign-link.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
  }
  return $localize`:@@sign-link.error.server:No pudimos completar la operación. Inténtalo de nuevo en unos minutos.`;
}
