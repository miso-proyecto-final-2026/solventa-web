import { TestBed } from '@angular/core/testing';
import { FileSaver } from './download';

describe('FileSaver', () => {
  it('should hand the file to the browser under its name and release the temporary URL', () => {
    const created = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    const revoked = spyOn(URL, 'revokeObjectURL');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    TestBed.inject(FileSaver).save(new Blob(['x']), 'reporte.csv');

    expect(created).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(link.download).toBe('reporte.csv');
    expect(link.href).toBe('blob:test');
    expect(revoked).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
