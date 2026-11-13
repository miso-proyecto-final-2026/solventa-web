import { Injectable } from '@angular/core';

/** Entrega un archivo ya descargado al navegador (el reporte exportado), sin dejar el enlace en el documento. */
@Injectable({ providedIn: 'root' })
export class FileSaver {
  save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
