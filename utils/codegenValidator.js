// This utility scans generated Manim code for banned patterns to prevent runtime errors
const bannedPatterns = [
  /Axes\s*\(/,
  /Surface\s*\(/,
  /ParametricFunction\s*\(/,
  /np\.math/,        // deprecated numpy math submodule
  /set_shade_in_scene/, // unsupported internal method
  /MathTex\s*\(/,
  /Tex\s*\(/,
  /import\s+np/,      // avoid numpy imports
  /import\s+numpy/,   // avoid numpy imports
];

function validateManimCode(code) {
  for (const pattern of bannedPatterns) {
    if (pattern.test(code)) {
      throw new Error(
        `Generated Manim code contains prohibited construct: ${pattern}`
      );
    }
  }
}

module.exports = validateManimCode; 