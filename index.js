// server-node/index.js
// Entry point for the backend server

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Utilities (to be implemented)
const detectChrome = require('./utils/detectChrome');
const detectManim = require('./utils/detectManim');

// Services (to be implemented)
const { generateWithP5 } = require('./services/p5Renderer');
const { generateWithManim } = require('./services/manimRenderer');
const { generateCode } = require('./services/codegenService');

// In-memory store for render jobs
const jobs = {};

const app = express();
app.use(cors());
app.use(express.json());

// Health-check endpoint
app.get('/health', async (req, res) => {
  const engine = req.query.engine;
  try{
    if(engine === 'p5') {
        await detectChrome();
      } else if (engine === 'manim') {
        await detectManim();
      } else{
        return res.status(400).json({available:false, reason:'Invalid engine'});
      }
    res.status(200).json({available:true});
  } catch (error) {
    res.status(200).json({ available: false, reason: error.message });
  }
});

// Generate endpoint
app.post('/api/generate', async (req, res) => {
  const { prompt, engine, apiKey } = req.body;
  const runId = uuidv4();
  jobs[runId] = { logs: [], status: 'pending', videoPath: null };

  try {
    jobs[runId].logs.push('Code generation started');
    const code = await generateCode(prompt, engine, apiKey);
    jobs[runId].logs.push('Code generation completed');

    setImmediate(async () => {
      jobs[runId].logs.push(`Rendering started using ${engine}`);
      try {
        let videoPath;
        if (engine === 'p5') {
          // Render with p5.js, passing a logger that pushes into our jobs map
          videoPath = await generateWithP5(code, runId, msg => jobs[runId].logs.push(msg));
        } else if (engine === 'manim') {
          // Render with Manim (no per-frame logs)
          videoPath = await generateWithManim(code, runId);
        } else {
          throw new Error('Invalid engine during render');
        }
        jobs[runId].videoPath = videoPath;
        jobs[runId].status = 'done';
        jobs[runId].logs.push('Rendering complete');
      } catch (err) {
        jobs[runId].logs.push(`Error: ${err.message}`);
        jobs[runId].status = 'done';
      }
    });

    return res.json({ runId });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Logs endpoint (Server-Sent Events)
app.get('/api/logs', (req, res) => {
  // 1) Extract and validate runId
  const runId = req.query.runId;
  if (!jobs[runId]) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // 2) Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // 3) Stream logs incrementally
  let lastIndex = 0;
  const sendLogs = () => {
    const allLogs = jobs[runId].logs;
    while (lastIndex < allLogs.length) {
      const log = allLogs[lastIndex++];
      res.write(`data: ${log}\n\n`);
    }
  };
  // Send any existing logs immediately
  sendLogs();

  // 4) Poll for new logs and final status
  const interval = setInterval(() => {
    sendLogs();
    if (jobs[runId].status === 'done') {
      // Send final event with videoPath
      const payload = JSON.stringify({ videoPath: jobs[runId].videoPath });
      res.write(`event: done\ndata: ${payload}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  // 5) Clean up when client disconnects
  req.on('close', () => clearInterval(interval));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 