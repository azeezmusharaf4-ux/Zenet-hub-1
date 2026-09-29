import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

/**
 * High-precision converter transforming modern OKLCH color strings into universally
 * compatible RGB/RGBA notation for older mobile browsers (iOS Safari < 15.4, Chrome < 111).
 */
function convertOklchToRgb(css: string): string {
  function oklchToRgb(lStr: string, cStr: string, hStr: string, aStr?: string): string {
    const L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    const C = parseFloat(cStr);
    const H = parseFloat(hStr) || 0;
    const alpha = aStr ? (aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr)) : 1;

    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    function toGamma(v: number): number {
      const clamped = Math.max(0, Math.min(1, v));
      return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    }

    const r = Math.round(toGamma(rLin) * 255);
    const g = Math.round(toGamma(gLin) * 255);
    const bVal = Math.round(toGamma(bLin) * 255);

    if (alpha !== undefined && alpha < 1) {
      return `rgba(${r}, ${g}, ${bVal}, ${Math.round(alpha * 1000) / 1000})`;
    }
    return `rgb(${r}, ${g}, ${bVal})`;
  }

  const oklchRegex = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/g;
  return css.replace(oklchRegex, (_match, l, c, h, a) => oklchToRgb(l, c, h, a));
}

function oklchFallbackPlugin(): Plugin {
  return {
    name: 'vite-plugin-css-oklch-fallback',
    enforce: 'post',
    transform(code: string, id: string) {
      if (id.endsWith('.css') || id.includes('.css?')) {
        return {
          code: convertOklchToRgb(code),
          map: null,
        };
      }
      return null;
    },
    generateBundle(_options: any, bundle: any) {
      for (const file in bundle) {
        const asset = bundle[file];
        if (asset.type === 'asset' && file.endsWith('.css') && typeof asset.source === 'string') {
          asset.source = convertOklchToRgb(asset.source);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      oklchFallbackPlugin(),
      legacy({
        targets: ['defaults', 'not IE 11', 'Android >= 4.4', 'iOS >= 9', 'chrome >= 49', 'safari >= 10'],
      }),
    ],
    build: {
      cssTarget: ['chrome49', 'safari10'],
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          passes: 1,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'firebase';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'lucide';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor';
            }
          },
        },
      },
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({
            overrideBrowserslist: [
              '> 0.2%',
              'last 2 versions',
              'Android >= 4.4',
              'iOS >= 9'
            ],
          }),
        ],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
