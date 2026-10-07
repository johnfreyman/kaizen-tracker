// The release build has separate browser storage and an offline shell from the
// isolated iPad test build. A release build must never load test device data.
export const IS_RELEASE = import.meta.env.MODE === 'stage4-release';
export const APP_PAGE = IS_RELEASE ? '/release.html' : '/stage4.html';
export const ASSET_MANIFEST = IS_RELEASE ? '/release-assets.json' : '/stage4-assets.json';
export const SERVICE_WORKER = IS_RELEASE ? '/sw-release.js' : '/sw-stage4.js';
export const SHELL_CACHE_PREFIX = IS_RELEASE ? 'kaizen-release-' : 'kaizen-';
export const DEVICE_STORAGE_PREFIX = IS_RELEASE ? 'kaizen-coach' : 'kaizen-stage4-test';
