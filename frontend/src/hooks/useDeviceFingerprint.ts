// ──────────────────────────────────────────────
// Device Fingerprint Hook
// Generates a browser-side device fingerprint that
// is sent with every authenticated API request for
// device authorization.
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export interface DeviceFingerprint {
  cpuIdentifier: string;
  macHash: string;
  osSerialHash: string;
  browserFingerprint: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
}

const FINGERPRINT_KEY = 'vireon_device_fingerprint';

/**
 * Generate a canvas-based browser fingerprint.
 * This creates a deterministic hash based on the browser's
 * rendering engine, GPU, and driver characteristics.
 */
async function generateCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'alphabetic';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.font = '16px Times New Roman';
    ctx.fillText('VireonOS', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '14px Courier New';
    ctx.fillText('DeviceAuth', 4, 34);

    // Add some emoji for platform-specific rendering
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText('🔐🖥️📱', 140, 40);

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

/**
 * Get a rough CPU identifier from hardware concurrency.
 */
function getCpuIdentifier(): string {
  return navigator.hardwareConcurrency?.toString() || 'unknown';
}

/**
 * Get a device fingerprint. Cached in sessionStorage so it persists
 * across page reloads but is cleared when the browser closes.
 */
export function useDeviceFingerprint(): DeviceFingerprint | null {
  const [fingerprint, setFingerprint] = useState<DeviceFingerprint | null>(() => {
    try {
      const cached = sessionStorage.getItem(FINGERPRINT_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (fingerprint) return;

    let mounted = true;

    async function generate() {
      const canvasFp = await generateCanvasFingerprint();

      const fp: DeviceFingerprint = {
        cpuIdentifier: getCpuIdentifier(),
        macHash: '',        // Not accessible from browser JS
        osSerialHash: '',    // Not accessible from browser JS
        browserFingerprint: canvasFp,
        screenResolution: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || 'en-US',
        platform: (navigator as any).platform || navigator.userAgent || 'unknown',
      };

      if (mounted) {
        try {
          sessionStorage.setItem(FINGERPRINT_KEY, JSON.stringify(fp));
        } catch { /* storage full - non-critical */ }
        setFingerprint(fp);
      }
    }

    generate();

    return () => { mounted = false; };
  }, [fingerprint]);

  return fingerprint;
}

/**
 * Get the cached fingerprint synchronously (for API interceptors).
 */
export function getCachedFingerprint(): DeviceFingerprint | null {
  try {
    const cached = sessionStorage.getItem(FINGERPRINT_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Convert fingerprint to HTTP headers.
 */
export function fingerprintToHeaders(fp: DeviceFingerprint): Record<string, string> {
  return {
    'x-device-browser-fp': fp.browserFingerprint,
    'x-device-resolution': fp.screenResolution,
    'x-device-timezone': fp.timezone,
    'x-device-language': fp.language,
    'x-device-platform': fp.platform,
    'x-device-cpu': fp.cpuIdentifier,
  };
}
