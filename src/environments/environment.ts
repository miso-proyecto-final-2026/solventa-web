export const environment = {
  production: true,
  apiBaseUrl: '/api',
  /** 'http' usa el backend; 'mock' usa datos simulados (desarrollo sin backend). */
  dataSource: 'http' as 'http' | 'mock',
};
