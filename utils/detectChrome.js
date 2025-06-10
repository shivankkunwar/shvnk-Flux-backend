// Enhanced Chrome detection for Electron apps
// Works in both development and packaged environments
const which = require("which");
const fs = require("fs");
const path = require("path");
const os = require("os");

let cachedChromePath;

// Check if running in Electron environment
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
const isDev = isElectron && require('electron-is-dev');

// Platform-specific Chrome installation paths
const CHROME_PATHS = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    'C:/Users/*/AppData/Local/Google/Chrome/Application/chrome.exe'
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ],
  linux: [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    path.join(os.homedir(), '/.local/bin/google-chrome')
  ]
};

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function detectChrome() {
  if (cachedChromePath) {
    return cachedChromePath;
  }

  console.log(`[Chrome Detection] Starting Chrome detection... (Electron: ${isElectron}, Dev: ${isDev})`);

  // 1) Check CHROME_PATH env var first
  const envPath = process.env.CHROME_PATH;
  if (envPath) {
    console.log(`[Chrome Detection] Checking CHROME_PATH: ${envPath}`);
    if (await checkFileExists(envPath)) {
      cachedChromePath = envPath;
      console.log(`[Chrome Detection] Found Chrome via CHROME_PATH: ${envPath}`);
      return cachedChromePath;
    } else {
      console.warn(`[Chrome Detection] CHROME_PATH exists but is not executable: ${envPath}`);
    }
  }

  // 2) Try chrome-launcher (works well in dev, may fail in packaged apps)
  if (isDev) {
    // Only try chrome-launcher in development mode
    try {
      console.log('[Chrome Detection] Trying chrome-launcher (dev mode)...');
      const { Launcher } = await import('chrome-launcher');
      const installs = await Launcher.getInstallations();
      if (installs.length > 0) {
        const stable = installs.find(p => !/beta|dev/i.test(p)) || installs[0];
        if (await checkFileExists(stable)) {
          cachedChromePath = stable;
          console.log(`[Chrome Detection] Found Chrome via chrome-launcher: ${stable}`);
          return cachedChromePath;
        }
      }
    } catch (err) {
      console.log(`[Chrome Detection] chrome-launcher failed: ${err.message}`);
    }
  } else {
    console.log('[Chrome Detection] Skipping chrome-launcher in packaged mode');
  }

  // 3) Try which() command (prioritize in dev, fallback in packaged)
  const candidates = ['google-chrome', 'chrome', 'chromium', 'google-chrome-stable'];
  for (const name of candidates) {
    try {
      console.log(`[Chrome Detection] Trying which('${name}')...`);
      const p = which.sync(name);
      if (await checkFileExists(p)) {
        cachedChromePath = p;
        console.log(`[Chrome Detection] Found Chrome via which: ${p}`);
        return cachedChromePath;
      }
    } catch (err) {
      console.log(`[Chrome Detection] which('${name}') failed: ${err.message}`);
    }
  }

  // 4) Platform-specific path scanning (essential for packaged apps)
  const platform = os.platform();
  const platformPaths = CHROME_PATHS[platform] || [];
  
  console.log(`[Chrome Detection] Scanning platform-specific paths for ${platform}...`);
  for (const chromePath of platformPaths) {
    console.log(`[Chrome Detection] Checking: ${chromePath}`);
    
    // Handle wildcard paths (like C:/Users/*/AppData/...)
    if (chromePath.includes('*')) {
      try {
        const basePath = chromePath.split('*')[0];
        const suffix = chromePath.split('*')[1];
        const dirs = await fs.promises.readdir(basePath);
        
        for (const dir of dirs) {
          const fullPath = path.join(basePath, dir, suffix);
          if (await checkFileExists(fullPath)) {
            cachedChromePath = fullPath;
            console.log(`[Chrome Detection] Found Chrome via wildcard path: ${fullPath}`);
            return cachedChromePath;
          }
        }
      } catch (err) {
        console.log(`[Chrome Detection] Wildcard path scan failed: ${err.message}`);
      }
    } else {
      // Regular path check
      if (await checkFileExists(chromePath)) {
        cachedChromePath = chromePath;
        console.log(`[Chrome Detection] Found Chrome at: ${chromePath}`);
        return cachedChromePath;
      }
    }
  }

  // 5) Final attempt: try common registry locations on Windows
  if (platform === 'win32') {
    console.log('[Chrome Detection] Trying Windows registry approach...');
    try {
      const { execSync } = require('child_process');
      const regQuery = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve';
      const output = execSync(regQuery, { encoding: 'utf8' });
      const matches = output.match(/REG_SZ\s+(.+)/);
      if (matches && matches[1]) {
        const regPath = matches[1].trim();
        if (await checkFileExists(regPath)) {
          cachedChromePath = regPath;
          console.log(`[Chrome Detection] Found Chrome via Windows registry: ${regPath}`);
          return cachedChromePath;
        }
      }
    } catch (err) {
      console.log(`[Chrome Detection] Registry query failed: ${err.message}`);
    }
  }

  // 6) Nothing found - provide helpful error message
  const platform_name = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[platform] || platform;
  const env = isDev ? 'development' : 'packaged';
  throw new Error(
    `Chrome executable not found on ${platform_name} (${env} mode). ` +
    `Please install Google Chrome from https://www.google.com/chrome/ or set CHROME_PATH environment variable. ` +
    `Searched paths: ${platformPaths.join(', ')}`
  );
}

module.exports = detectChrome;
