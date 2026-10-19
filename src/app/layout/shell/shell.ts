import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';

@Component({
  selector: 'sol-shell',
  imports: [Header, Footer, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {}
