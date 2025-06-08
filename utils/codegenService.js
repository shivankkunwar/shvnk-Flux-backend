const { GoogleGenAI } = require("@google/genai");
const { manimSystemPrompt } = require('./manimPrompts');
const { p5SystemPrompt } = require('./p5Prompts');
const validateManimCode = require('./codegenValidator');

async function generateCode(prompt, engine, apiKey) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  let model = "gemini-2.0-flash";
  let contents;

  if (engine === "p5") {
    // Prompt for p5.js code using detailed system prompt
    const userPrompt = `Sketch description: ${prompt}`;
    contents = [p5SystemPrompt, userPrompt].join("\n");
  } else if (engine === "manim") {
    // Prompt for Manim code using the shared system prompt
    const userPrompt = `Scene description: ${prompt}`;
    contents = [manimSystemPrompt, userPrompt].join("\n");
  } else {
    throw new Error("Invalid engine in generateCode");
  }

  // Call the text generation API with the assembled prompt
  const response = await ai.models.generateContent({ model, contents });
  // Extract the raw code text
  const raw = response.text;
  const cleaned = cleanCode(raw);
  // Validate against banned Manim constructs to avoid runtime errors
  if (engine === 'manim') validateManimCode(cleaned);
  validateGeneratedCode(cleaned, engine);
  return cleaned;
}

function cleanCode(raw){
  return raw
    .trim()
    .replace(/^```(?:\w+)?\s*/, '')
    .replace(/\s*```$/, '');
}

// Validate structure of generated code
function validateGeneratedCode(code, engine) {
  const trimmed = code.trim();
  if (engine === 'p5' && !trimmed.startsWith('function setup()')) {
    throw new Error("Invalid p5.js generation: must start with 'function setup()'");
  }
  if (engine === 'manim' && !trimmed.includes('class GeneratedScene')) {
    throw new Error("Invalid Manim generation: must contain 'class GeneratedScene'");
  }
}

module.exports = { generateCode };