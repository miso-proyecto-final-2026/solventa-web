import { Component } from '@angular/core';
import { Shell } from '@layout/shell/shell';

@Component({
  imports: [Shell],
  selector: 'sol-root',
  template: '<sol-shell />',
})
export class App {}
