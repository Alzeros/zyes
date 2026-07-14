// Single source of truth for the app version, shown in the About dialog.
// The value is injected at build time by Vite (vite.config.ts define),
// which reads it from package.json. Bump the version in package.json only.
declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';