// -----------------------------------------------------------------------------
// The configuration the administrator fills (manifest `config_schema`),
// normalized. The token is sent to the OpenFamily server only, never logged.
// -----------------------------------------------------------------------------

// Defaults: they MUST match the `default` values of the manifest.
export const DEFAULT_CONFIG = {
  poll_minutes: 5,
  shopping_category: 'Autre',
};

const number = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== null
    ? Math.min(max, Math.max(min, Math.round(n)))
    : fallback;
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The server address without a trailing slash, or '' when it is not an http(s) URL. */
export function normalizeUrl(value) {
  const raw = text(value).replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : '';
  } catch {
    return '';
  }
}

/** An IANA time zone name the runtime knows ("Europe/Paris"), or ''. */
export function normalizeTimeZone(value) {
  const zone = text(value);
  if (!zone) return '';
  try {
    return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

export function normalizeConfig(raw = {}) {
  const source = raw ?? {};
  return {
    url: normalizeUrl(source.url),
    token: text(source.token),
    pollMinutes: number(source.poll_minutes, DEFAULT_CONFIG.poll_minutes, 1, 60),
    shoppingCategory: text(source.shopping_category) || DEFAULT_CONFIG.shopping_category,
    timeZone: normalizeTimeZone(source.timezone),
  };
}

/** True when the integration can reach a server at all. */
export const isConfigured = (config) => Boolean(config.url && config.token);
