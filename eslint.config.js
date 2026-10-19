// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'sol',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'sol',
          style: 'kebab-case',
        },
      ],
    },
  },
  // Regla de dependencias entre capas: solo hacia abajo (features -> layout -> shared -> core).
  ...[
    ['core', ['@shared/*', '@layout/*', '@features/*'], 'core no puede depender de shared, layout ni features.'],
    ['shared', ['@layout/*', '@features/*'], 'shared no puede depender de layout ni features.'],
    ['layout', ['@features/*'], 'layout no puede depender de features.'],
    ['features', ['@features/*'], 'Una feature no importa de otra feature; comparte por core o shared.'],
  ].map(([layer, group, message]) => ({
    files: [`src/app/${layer}/**/*.ts`],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group, message }] }] },
  })),
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
