export const environment = {
  production: false,
  apiBaseUrl: '/api',
  /** 'http' usa el backend; 'mock' usa datos simulados (desarrollo sin backend). */
  dataSource: 'http' as 'http' | 'mock',
};
