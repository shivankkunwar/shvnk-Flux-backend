const { generateWithManim } = require('./manimRenderer');

function dedent(str) {
  const lines = str.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  const indent = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length).sort()[0];
  return lines.map(l => l.slice(indent)).join('\n');
}

(async () => {
    const code = dedent(`
from manim import *
class GeneratedScene(Scene):
    def construct(self):
        text = Text("Hello, Manim!")
        self.play(Write(text))
        self.wait(1)
`);
  
  const runId = 'test-'+Date.now();
  try{
    const videoPath = await generateWithManim(code, runId);
    console.log('✅ Manim render succeeded:', videoPath);
    } catch (err) {
      console.error('❌ Manim render failed:', err.message);
    }
})();