import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

// Get version from environment, git tag, or package.json.
//
// Resolution order:
//   1. process.env.VERSION  — set by the release pipeline from the git tag.
//   2. git describe --tags --abbrev=0  — the latest tag reachable from
//      HEAD. This keeps local dev builds on a sensible version (the most
//      recent release) instead of falling back to "dev" when HEAD is past
//      a tag or on an un-tagged commit.
//   3. git describe --tags  — the tag nearest to HEAD with a distance
//      suffix (e.g. v1.15.0-3-5-gabc1234). Used as a secondary fallback so
//      builds from shallow clones still surface a tag name.
//   4. package.json version  — used when git is unavailable.
//   5. "dev"  — last resort.
function getVersion(): string {
  // 1. Environment variable (set by GitHub Actions)
  if (process.env.VERSION) {
    return process.env.VERSION;
  }

  // 2. Latest tag reachable from HEAD
  try {
    const latestTag = execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf8' }).trim();
    if (latestTag) {
      return latestTag;
    }
  } catch {
    // Git not available or no tags
  }

  // 3. Nearest tag with distance suffix
  try {
    const nearestTag = execSync('git describe --tags 2>/dev/null', { encoding: 'utf8' }).trim();
    if (nearestTag) {
      return nearestTag;
    }
  } catch {
    // Git not available or no tags
  }

  // 4. Fall back to package.json version
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
    if (pkg.version && pkg.version !== '0.0.0') {
      return pkg.version;
    }
  } catch {
    // package.json not readable
  }

  // 5. Last resort
  return 'dev';
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile({
      removeViteModuleLoader: true
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(getVersion())
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`
      }
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        codeSplitting: false
      }
    }
  }
});
