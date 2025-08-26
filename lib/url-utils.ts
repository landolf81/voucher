/**
 * URL Utility Functions
 * Provides environment-aware URL generation for different deployment platforms
 */

/**
 * Get the base URL for the application based on the current environment
 * Automatically detects deployment platform and returns appropriate URL
 */
export function getBaseUrl(): string {
  // 1. Check for explicitly configured base URL (highest priority)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // 2. Vercel deployment environment
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 3. Railway deployment environment
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`;
  }

  // 4. Netlify deployment environment
  if (process.env.URL) {
    return process.env.URL;
  }

  // 5. Check if running in production mode
  if (process.env.NODE_ENV === 'production') {
    // In production without explicit URL, try to detect from headers
    // This will be overridden by server-side logic if needed
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Default production URL (update this with your actual domain)
    console.warn('No base URL configured for production. Using default.');
    return 'https://voucher.example.com';
  }

  // 6. Development environment default
  return 'http://localhost:3000';
}

/**
 * Get the base URL for server-side operations
 * Uses request headers when available for more accurate URL detection
 */
export function getServerBaseUrl(headers?: Headers): string {
  // Try to get from headers first (most accurate for server-side)
  if (headers) {
    const host = headers.get('host');
    const proto = headers.get('x-forwarded-proto') || 'http';
    if (host) {
      return `${proto}://${host}`;
    }
  }

  // Fall back to environment detection
  return getBaseUrl();
}

/**
 * Construct a full URL path relative to the base URL
 */
export function getFullUrl(path: string, headers?: Headers): string {
  const baseUrl = headers ? getServerBaseUrl(headers) : getBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Check if the current environment is development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || 
         getBaseUrl().includes('localhost');
}

/**
 * Check if the current environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' && 
         !getBaseUrl().includes('localhost');
}