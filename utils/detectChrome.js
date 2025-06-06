// We'll dynamically import chrome-launcher as an ES module
const which = require("which");
const fs = require("fs");

let cachedChromePath;

async function detectChrome() {
  if (cachedChromePath) {
    return cachedChromePath;
  }

  // 1) Check CHROME_PATH env var
  const envPath = process.env.CHROME_PATH;
  if (envPath) {
    try {
      await fs.promises.access(envPath, fs.constants.X_OK);
      cachedChromePath = envPath;
      return cachedChromePath;
    } catch (error) {
      console.error(`Error accessing CHROME_PATH: ${error.message}`);
    }
  }

  // 2) Attempt to scan known Chrome installations via chrome-launcher
  try {
    const { Launcher } = await import('chrome-launcher');
    const installs = await Launcher.getInstallations();
    if (installs.length > 0) {
      const stable = installs.find(p => !/beta|dev/i.test(p)) || installs[0];
      cachedChromePath = stable;
      return cachedChromePath;
    }
  } catch (err) {
    // dynamic import or scanning failed—fall through to which()
  }

  // 3) Fallback to which() lookups
  const candidates = ['google-chrome', 'chrome', 'chromium'];
  for (const name of candidates) {
    try {
      const p = which.sync(name);
      cachedChromePath = p;
      return cachedChromePath;
    } catch (err) {
      // not found, try next
    }
  }

  // 4) Nothing found – throw an informative error
  throw new Error(
    "Chrome executable not found. Please install Chrome or set CHROME_PATH environment variable."
  );
}

module.exports = detectChrome;
