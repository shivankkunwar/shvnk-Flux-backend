// server-node/testP5.js
// Simple test for the p5.js renderer service

const path = require('path');
const { generateWithP5 } = require('./services/p5Renderer');

(async () => {
  // Minimal p5.js code: bouncing circle on a dark background
  const sketchCode = `
function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  noStroke();
  fill(100, 200, 250);
  const d = 50 + 25 * sin(frameCount * 0.1);
  ellipse(width / 2, height / 2, d, d);
}
`;

  // Unique runId for testing
  const runId = 'test-p5-' + Date.now();
  console.log('Starting p5 render with runId:', runId);

  try {
    const videoPath = await generateWithP5(sketchCode, runId, msg => console.log(`[testP5] ${msg}`));
    console.log('✅ p5.js render succeeded. Video at:', videoPath);
  } catch (err) {
    console.error('❌ p5.js render failed:', err);
  }
})(); 