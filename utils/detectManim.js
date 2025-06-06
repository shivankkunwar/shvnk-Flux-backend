/** 
 * Attempts to locate the system-installed Manim (CE) executable.
 * Resolution steps:
 *   1) Check MANIM_PATH env var and verify it's an executable
 *   2) Try `which('manim')`
 *   3) Try `which('manimce')`
 *   4) Verify Python interpreter exists
 *   5) If none found, throw an error instructing the user to `pip install manim`
 */

const which = require('which');
const fs   = require('fs');

let cachedManimPath;

async function detectManim() {
  if (cachedManimPath) {
    return cachedManimPath;
  }

  // 1) Environment variable override
  const envPath = process.env.MANIM_PATH;
  if (envPath) {
    try {
      await fs.promises.access(envPath, fs.constants.X_OK);
      cachedManimPath = envPath;
      return cachedManimPath;
    } catch {
      // exists but not executable, or missing → fall through
    }
  }

  // 2) Primary binary lookup
  try {
    const p = which.sync('manim');
    cachedManimPath = p;
    return p;
  } catch {}

  // 3) Alternate binary lookup
  try {
    const p = which.sync('manimce');
    cachedManimPath = p;
    return p;
  } catch {}

  // 4) Verify Python interpreter exists
  try {
    which.sync('python3');
  } catch {
    try {
      which.sync('python');
    } catch {
      throw new Error(
        'Python executable not found. Please install Python 3.10+ and Manim Community Edition.'
      );
    }
  }

  // 5) Nothing found
  throw new Error(
    'Manim executable not found. Please install Manim Community Edition (e.g. `pip install manim`).'
  );
}

module.exports = detectManim;
