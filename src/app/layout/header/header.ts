import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageSelector } from '../language-selector/language-selector';
import { NAV_ITEMS } from './nav-items';

@Component({
  selector: 'sol-header',
  imports: [RouterLink, RouterLinkActive, LanguageSelector],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly navItems = NAV_ITEMS;
}
