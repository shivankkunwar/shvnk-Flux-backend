const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const detectManim = require('../utils/detectManim');

// Directories for scripts and generated media
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const MEDIA_DIR   = path.join(__dirname, '..', 'media', 'videos');

/**
 * Renders a Manim Scene to a video file.
 * @param {string} code  - The Python code defining class GeneratedScene(Scene)
 * @param {string} runId - Unique identifier for this render job
 * @returns {Promise<string>} - Resolves to the path of the generated MP4
 */
async function generateWithManim(code, runId) {
  // 1) Ensure output directories exist
  if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const outDir = path.join(MEDIA_DIR, runId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 2) Write the Python code to a script file
  const scriptPath = path.join(SCRIPTS_DIR, `${runId}.py`);
  fs.writeFileSync(scriptPath, code);

  // 3) Locate the Manim executable
  const manimCmd = await detectManim();

  // 4) Spawn the Manim CLI to render GeneratedScene
  const args = ['-qk', '--disable_caching', scriptPath, 'GeneratedScene', '-o', outDir];
  return new Promise((resolve, reject) => {
    const proc = spawn(manimCmd, args);

    // Optional: hook into stdout/stderr for debugging
    proc.stdout.on('data', data => console.log(`[manim:${runId}] stdout: ${data}`));
    proc.stderr.on('data', data => console.error(`[manim:${runId}] stderr: ${data}`));
    proc.on('error', err => reject(err));

    proc.on('close', code => {
      if (code === 0) {
        const videoPath = path.join(outDir, 'GeneratedScene.mp4');
        resolve(videoPath);
      } else {
        reject(new Error(`Manim process exited with code ${code}`));
      }
    });
  });
}

module.exports = { generateWithManim }; 