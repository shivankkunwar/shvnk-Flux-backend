// server-node/api.js
// API module for Electron IPC handlers

// Keep these require statements for utilities and services
const detectChrome = require('./utils/detectChrome');
const detectManim = require('./utils/detectManim');
const { generateWithP5 } = require('./services/p5Renderer');
const { generateWithManim } = require('./services/manimRenderer');
const { generateCode } = require('./utils/codegenService');
const { performHealthCheck } = require('./services/healthCheck');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function setupApiHandlers(ipcMain) {
  // All our new IPC handlers will go inside this function
  
  // Handler for health checks - replaces GET /health
  ipcMain.handle('check-health', async (event, engine) => {
    try {
      // Perform comprehensive health check using existing service
      const healthResults = await performHealthCheck(engine || 'both');
      
      // Extract availability from the health results
      let available = false;
      if (engine === 'p5') {
        available = healthResults.p5?.available || false;
      } else if (engine === 'manim') {
        available = healthResults.manim?.available || false;
      } else {
        // For 'both' or other cases, check if either is available
        available = (healthResults.p5?.available || false) || (healthResults.manim?.available || false);
      }
      
      // Return format expected by frontend
      return {
        success: true,
        available: available,
        ...healthResults
      };
    } catch (error) {
      // Return failure with error details
      return {
        success: false,
        available: false,
        reason: error.message,
        timestamp: new Date().toISOString()
      };
    }
  });

  // Handler for video generation - replaces POST /api/generate
  ipcMain.handle('generate-video', async (event, { prompt, engine, apiKey, duration }) => {
    // Generate a unique run ID for this render job
    const runId = uuidv4();
    
    // Helper function to send logs back to frontend via IPC
    const log = (message) => {
      event.sender.send('render-log', {
        message,
        timestamp: new Date().toISOString()
      });
    };

    try {
      // Step 1: Code generation
      log('Code generation started...');
      const code = await generateCode(prompt, engine, apiKey);
      log('Code generation finished - preparing for video rendering');

      // Step 2: Video rendering
      log(`Video rendering started using ${engine}`);
      let videoPath;
      
      if (engine === 'p5') {
        // Render with p5.js, passing our log function for real-time updates
        videoPath = await generateWithP5(code, runId, log, duration);
      } else if (engine === 'manim') {
        // Render with Manim, passing our log function for progress updates
        videoPath = await generateWithManim(code, runId, log);
      } else {
        throw new Error(`Invalid engine: ${engine}`);
      }

      // Step 3: Return success with video path
      const filename = path.basename(videoPath, '.mp4'); // Remove .mp4 extension for ID
      
      // Create two URLs:
      // 1. A custom protocol URL for secure, in-app playback
      const playbackUrl = `app-video://${filename}`;
      // 2. A standard file URL for the download functionality
      const downloadUrl = `file://${videoPath}`;
      
      log('Video generation completed successfully');
      
      return {
        success: true,
        videoPath: playbackUrl,    // For the <video> tag
        downloadPath: downloadUrl, // For the "Download" button
        filename: filename + '.mp4'
      };

    } catch (error) {
      // Log the error and re-throw so frontend promise rejects
      log(`Error: ${error.message}`);
      throw error;
    }
  });
}

module.exports = { setupApiHandlers }; 