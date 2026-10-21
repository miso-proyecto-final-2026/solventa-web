import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';

@Component({
  selector: 'sol-shell',
  imports: [Header, Footer, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private firstNavigation = true;

  constructor() {
    // Al cambiar de pantalla el foco pasa al contenido, para quien navega con teclado o lector.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.firstNavigation) {
          this.firstNavigation = false; // al abrir la app no se le quita el foco al navegador
          return;
        }
        this.main().nativeElement.focus({ preventScroll: true });
      });
  }
}
