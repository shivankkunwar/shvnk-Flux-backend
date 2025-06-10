const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { spawn } = require('child_process');
const detectManim = require('../utils/detectManim');

// Directories for scripts and generated media
const SCRIPTS_DIR = path.join(app.getPath('userData'), 'scripts');
const MEDIA_DIR   = path.join(app.getPath('userData'), 'media', 'videos');

/**
 * Renders a Manim Scene to a video file.
 * @param {string} code  - The Python code defining class GeneratedScene(Scene)
 * @param {string} runId - Unique identifier for this render job
 * @param {function(string):void} [logFn] - Optional logging callback
 * @returns {Promise<string>} - Resolves to the path of the generated MP4
 */
async function generateWithManim(code, runId, logFn = () => {}) {
  // 1) Ensure output directories exist
  if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const outDir = path.join(MEDIA_DIR, runId);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 2) Write the Python code to a script file
  const scriptPath = path.join(SCRIPTS_DIR, `${runId}.py`);
  fs.writeFileSync(scriptPath, code);
  logFn('Manim script written');

  // 3) Locate the Manim executable
  const manimCmd = await detectManim();
  logFn('Manim executable found');

  // 4) Spawn the Manim CLI to render GeneratedScene
  const args = ['-qk', '--disable_caching', scriptPath, 'GeneratedScene', '-o', outDir];
  return new Promise((resolve, reject) => {
    logFn('Starting Manim rendering...');
    const proc = spawn(manimCmd, args);

    let stdoutData = '';
    let stderrData = '';

    // Capture stdout and stderr
    proc.stdout.on('data', data => {
      const output = data.toString();
      stdoutData += output;
      logFn(`[Manim] ${output.trim()}`);
    });
    
    proc.stderr.on('data', data => {
      const output = data.toString();
      stderrData += output;
      
      // Distinguish between progress messages and actual errors
      const outputTrimmed = output.trim();
      const isProgress = outputTrimmed.includes('Animation') && 
                        (outputTrimmed.includes('%|') || outputTrimmed.includes('it/s'));
      const isActualError = (outputTrimmed.toLowerCase().includes('error') || 
                           outputTrimmed.toLowerCase().includes('traceback') ||
                           outputTrimmed.toLowerCase().includes('exception')) && !isProgress;
      
      if (isProgress) {
        logFn(`[Manim Progress] ${outputTrimmed}`);
      } else if (isActualError) {
        logFn(`[Manim Error] ${outputTrimmed}`);
      } else {
        // General stderr output (warnings, info, etc.)
        logFn(`[Manim] ${outputTrimmed}`);
      }
    });
    
    proc.on('error', err => {
      logFn(`Process error: ${err.message}`);
      reject(new Error(`Failed to start Manim: ${err.message}`));
    });

    proc.on('close', code => {
      if (code === 0) {
        logFn('Manim rendering completed successfully');
        // Manim creates videos in nested quality folders like 2160p60/, 1080p60/, etc.
        // We need to find the actual video file and move it to the expected location
        try {
          const finalVideoPath = path.join(MEDIA_DIR, `${runId}.mp4`);
          
          // First, check if the video already exists (in case of previous successful run)
          if (fs.existsSync(finalVideoPath)) {
            logFn(`Video already exists at: ${finalVideoPath}`);
            // Clean up the working directory
            if (fs.existsSync(outDir)) {
              fs.rmSync(outDir, { recursive: true, force: true });
            }
            resolve(finalVideoPath);
            return;
          }
          
          // Search for the generated video in the nested structure
          const findManimVideo = (dir) => {
            if (!fs.existsSync(dir)) return null;
            
            logFn(`Searching in directory: ${dir}`);
            const items = fs.readdirSync(dir);
            logFn(`Found items: ${items.join(', ')}`);
            
            for (const item of items) {
              const itemPath = path.join(dir, item);
              
              // Skip if item doesn't exist (race condition protection)
              if (!fs.existsSync(itemPath)) continue;
              
              const stat = fs.statSync(itemPath);
              
              if (stat.isFile() && item === 'GeneratedScene.mp4') {
                logFn(`Found final video at: ${itemPath}`);
                return itemPath;
              } else if (stat.isDirectory()) {
                const found = findManimVideo(itemPath);
                if (found) return found;
              }
            }
            return null;
          };
          
          logFn(`Searching for GeneratedScene.mp4 in: ${outDir}`);
          let manimVideoPath = findManimVideo(outDir);
          
          // If not found in nested structure, check common Manim output locations
          if (!manimVideoPath) {
            const commonLocations = [
              path.join(outDir, 'GeneratedScene.mp4'),
              path.join(outDir, '2160p60', 'GeneratedScene.mp4'),
              path.join(outDir, '1080p60', 'GeneratedScene.mp4'),
              path.join(outDir, '720p30', 'GeneratedScene.mp4'),
              path.join(outDir, '480p15', 'GeneratedScene.mp4')
            ];
            
            for (const location of commonLocations) {
              if (fs.existsSync(location)) {
                logFn(`Found video at common location: ${location}`);
                manimVideoPath = location;
                break;
              }
            }
          }
          
          if (manimVideoPath && fs.existsSync(manimVideoPath)) {
            // Move the video to the root media/videos directory with runId as filename
            fs.copyFileSync(manimVideoPath, finalVideoPath);
            
            // Clean up the nested directory structure
            fs.rmSync(outDir, { recursive: true, force: true });
            
            logFn(`Video successfully saved to ${finalVideoPath}`);
            resolve(finalVideoPath);
          } else {
            // Check if we have partial files - this indicates an incomplete render
            const checkForPartialFiles = (dir) => {
              if (!fs.existsSync(dir)) return [];
              
              let partialFiles = [];
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const itemPath = path.join(dir, item);
                if (!fs.existsSync(itemPath)) continue;
                
                const stat = fs.statSync(itemPath);
                if (stat.isFile() && (item.includes('uncached_') || item.includes('partial'))) {
                  partialFiles.push(itemPath);
                } else if (stat.isDirectory()) {
                  partialFiles.push(...checkForPartialFiles(itemPath));
                }
              }
              return partialFiles;
            };
            
            const partialFiles = checkForPartialFiles(outDir);
            
            if (partialFiles.length > 0) {
              logFn(`Found ${partialFiles.length} partial files, but no final GeneratedScene.mp4`);
              logFn('This indicates Manim failed during the final assembly phase');
              
              // Check one more time if the video exists in the root directory
              // (sometimes Manim creates it directly there)
              const rootVideoPath = path.join(MEDIA_DIR, 'GeneratedScene.mp4');
              if (fs.existsSync(rootVideoPath)) {
                logFn(`Found video in root directory: ${rootVideoPath}`);
                fs.copyFileSync(rootVideoPath, finalVideoPath);
                fs.unlinkSync(rootVideoPath); // Remove the temp file
                
                // Clean up partial files
                fs.rmSync(outDir, { recursive: true, force: true });
                
                logFn(`Video successfully saved to ${finalVideoPath}`);
                resolve(finalVideoPath);
                return;
              }
              
              // Clean up partial files
              fs.rmSync(outDir, { recursive: true, force: true });
              
              reject(new Error('Manim rendering incomplete: Final video assembly failed. This may be due to complex animations or system resource constraints. Try simplifying the prompt.'));
            } else {
              logFn('No video files found in output directory');
              try {
                logFn(`Directory contents: ${fs.readdirSync(outDir).join(', ')}`);
              } catch (e) {
                logFn('Could not read directory contents');
              }
              
              reject(new Error(`Could not find GeneratedScene.mp4 in ${outDir}. Manim may have failed silently.`));
            }
          }
        } catch (err) {
          logFn(`Error processing video: ${err.message}`);
          reject(new Error(`Error processing Manim output: ${err.message}`));
        }
      } else {
        // Parse stderr for user-friendly error messages
        let errorMessage = 'Manim rendering failed';
        
        // Enhanced error parsing
        if (stderrData.includes('TypeError')) {
          if (stderrData.includes('use_quadratic_bezier')) {
            errorMessage = 'Code uses deprecated Manim API. Please try regenerating with a simpler prompt.';
          } else if (stderrData.includes('unexpected keyword argument')) {
            errorMessage = 'Generated code uses incorrect method parameters. Try regenerating with a different approach.';
          } else {
            errorMessage = 'TypeError in generated code. The AI may have used incorrect method parameters.';
          }
        } else if (stderrData.includes('AttributeError')) {
          errorMessage = 'AttributeError in generated code. The AI may have used non-existent methods.';
        } else if (stderrData.includes('ImportError') || stderrData.includes('ModuleNotFoundError')) {
          errorMessage = 'Missing required Python packages for Manim rendering.';
        } else if (stderrData.includes('SyntaxError')) {
          errorMessage = 'Syntax error in generated Python code.';
        } else if (stderrData.includes('NameError')) {
          errorMessage = 'Variable or function name error in generated code.';
        } else if (stderrData.includes('MemoryError') || stderrData.includes('OutOfMemoryError')) {
          errorMessage = 'Insufficient memory for rendering. Try reducing animation complexity or duration.';
        } else if (stderrData.includes('FFmpeg')) {
          errorMessage = 'Video encoding failed. There may be an issue with the animation timeline or FFmpeg.';
        }
        
        logFn(`Rendering failed with exit code ${code}: ${errorMessage}`);
        logFn('Full error output:');
        logFn(stderrData);
        
        // Clean up any partial files
        if (fs.existsSync(outDir)) {
          fs.rmSync(outDir, { recursive: true, force: true });
        }
        
        reject(new Error(errorMessage));
      }
    });
  });
}

module.exports = { generateWithManim }; 