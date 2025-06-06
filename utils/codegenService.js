const { GoogleGenAI } = require("@google/genai");

async function generateCode(prompt, engine, apiKey) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  let messages;
  let model = "gemini-2.0-flash";

  if (engine === "p5") {
    model = "gemini-2.5-pro";
    messages = [
      {
        role: "system",
        content: "Generate valid p5.js JavaScript. Start with function setup(). No explanations, comments, or markdown."
      },
      { role: "user", content: `p5.js sketch: ${prompt}` }
    ];
  } else if (engine === "manim") {
    model = "gemini-2.5-pro";
    messages = [
      {
        role: "system",
        content: "Generate Python with class GeneratedScene extends Scene. No explanations, comments, or markdown."
      },
      { role: "user", content: `Manim scene: ${prompt}` }
    ];
  } else {
    throw new Error("Invalid engine in generateCode");
  }

  const res = await ai.generateContent({ model, messages });
  const raw = res.text();
  const cleaned = cleanCode(raw);
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


