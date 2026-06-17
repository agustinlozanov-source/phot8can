/**
 * Cliente HTTP para la API de Zernio.
 * Wrapper sobre fetch nativo con auth Bearer.
 */

const ZERNIO_BASE = 'https://zernio.com/api/v1';

export async function zernioFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error('ZERNIO_API_KEY not configured');

  const response = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zernio API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}
