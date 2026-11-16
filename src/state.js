// -----------------------------------------------------------------------------
// What the integration remembers from one start to the next. It lives in
// /data, the only directory of the container that is writable and kept. Losing
// it costs a repeated scene trigger, never any data: a failure here is silent.
// -----------------------------------------------------------------------------

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const STATE_DIR = '/data';
const FILE = 'state.json';

/**
 * @param {string | null} dir where the state is kept; null: nowhere, memory only
 */
export function createStateStore(dir) {
  const file = dir ? join(dir, FILE) : null;
  return {
    /** The saved state, or {} when there is none that can be read. */
    load() {
      if (!file) return {};
      try {
        const state = JSON.parse(readFileSync(file, 'utf8'));
        return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
      } catch {
        return {};
      }
    },

    /** Replaces the saved state: written aside then renamed, never half a file. */
    save(state) {
      if (!file) return false;
      try {
        writeFileSync(`${file}.tmp`, JSON.stringify(state));
        renameSync(`${file}.tmp`, file);
        return true;
      } catch {
        return false;
      }
    },
  };
}
