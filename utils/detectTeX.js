const which = require('which');

function detectTeX() {
  try {
    which.sync('latex');
    return;
  } catch {
    try {
      which.sync('pdflatex');
      return;
    } catch {
      throw new Error(
        'LaTeX engine not found. Please install a TeX distribution (e.g., MiKTeX or TeX Live) to support MathTex rendering in Manim.'
      );
    }
  }
}

module.exports = detectTeX; 