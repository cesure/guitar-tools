/**
 * localStorage mit Fallback – im privaten Modus oder bei gesperrtem Speicher einfach ohne Speichern weiter.
 *
 * Gespeicherte Werte werden nur übernommen, wenn sie zum Standardwert passen (gleicher Typ, Listen gleich lang).
 * So kann eine neue App-Version Einstellungen umbauen, ohne dass alte oder kaputte Daten etwas zum Absturz bringen.
 * Ist `fallback` leer ({}), wird jedes Objekt mit Zahlenwerten akzeptiert (z. B. Bestzeiten).
 */
export function load<T extends object>(key: string, fallback: T, check?: (v: T) => T): T {
  let out = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) out = merge(fallback, JSON.parse(raw));
  } catch {
    out = fallback;
  }
  try {
    return check ? check({ ...out }) : out;
  } catch {
    return fallback;
  }
}

function merge<T extends object>(fallback: T, stored: unknown): T {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fallback;
  const src = stored as Record<string, unknown>;
  const keys = Object.keys(fallback);
  // Freie Schlüssel (z. B. Bestzeiten je Modus): nur endliche Zahlen übernehmen
  if (keys.length === 0) {
    return Object.fromEntries(Object.entries(src).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) as T;
  }
  const out: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
  for (const k of keys) {
    const def = (fallback as Record<string, unknown>)[k];
    const v = src[k];
    if (Array.isArray(def)) {
      if (Array.isArray(v) && v.length === def.length && v.every((x, i) => typeof x === typeof def[i])) out[k] = v;
    } else if (typeof def === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    } else if (typeof v === typeof def && v !== null) {
      out[k] = v;
    }
  }
  return out as T;
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorieren */
  }
}

/* Kleine Helfer für die Prüfung einzelner Werte */
export const clampInt = (v: number, min: number, max: number, def: number) =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : def;
export const oneOf = <V>(v: V, allowed: readonly V[], def: V): V => (allowed.includes(v) ? v : def);
