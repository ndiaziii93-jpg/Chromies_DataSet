import type { CSSProperties } from 'react';

/**
 * Turns a CSS declaration string into a React style object.
 *
 * The design handoff is a single HTML prototype whose every element carries an
 * inline `style="..."`, and the brief is to recreate it pixel-faithfully. Keeping
 * those declarations as literal CSS — rather than hand-transcribing several hundred
 * of them into camelCase object literals — means each element in this app can be
 * diffed against the prototype line for line, and shorthands the prototype leans on
 * (`font:600 11px 'IBM Plex Mono',monospace`) survive unchanged.
 *
 * Results are cached by string, so the parse cost is paid once per distinct
 * declaration rather than once per render.
 */
const cache = new Map<string, CSSProperties>();

const toCamel = (prop: string) =>
  prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function parse(decl: string): CSSProperties {
  const out: Record<string, string> = {};
  let depth = 0;
  let start = 0;
  // Split on top-level semicolons only: `url(a;b)` and `rgba(...)` must stay intact.
  for (let i = 0; i <= decl.length; i++) {
    const ch = decl[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ';' && depth === 0) || i === decl.length) {
      const chunk = decl.slice(start, i).trim();
      start = i + 1;
      if (!chunk) continue;
      const colon = chunk.indexOf(':');
      if (colon === -1) continue;
      out[toCamel(chunk.slice(0, colon).trim())] = chunk.slice(colon + 1).trim();
    }
  }
  return out as CSSProperties;
}

export function css(decl: string): CSSProperties {
  let hit = cache.get(decl);
  if (!hit) {
    hit = Object.freeze(parse(decl)) as CSSProperties;
    cache.set(decl, hit);
  }
  return hit;
}

/** `css()` plus a few computed declarations, for the many styles the prototype interpolates into. */
export function cssx(decl: string, extra: CSSProperties): CSSProperties {
  return { ...css(decl), ...extra };
}
