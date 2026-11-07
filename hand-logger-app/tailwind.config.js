/** @type {import('tailwindcss').Config} */
import baseConfig from '../client/tailwind.config.js';

export default {
  ...baseConfig,
  // Reused Hand Logger components live physically under ../client/src — Tailwind's
  // JIT purges any class it never sees referenced in `content`, so without this glob
  // the imported components would render with zero styling.
  content: ['./index.html', './src/**/*.{js,jsx}', '../client/src/**/*.{js,jsx}'],
};
