/**
 * Image URL Resolution Utility for FEXA
 *
 * Resolves static backend image paths (e.g. /uploads/products/...) to full URLs
 * using the configured VITE_API_BASE_URL, while preserving external URLs (https://, http://, data:, blob:),
 * public static assets, and safe fallbacks.
 */

const rawEnvUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE_URL : undefined;

export const API_BASE_URL = rawEnvUrl
  ? rawEnvUrl.replace(/\/+$/, "")
  : typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

/**
 * Resolves a given image path to a full displayable URL.
 *
 * @param {string|null|undefined} path - The raw image path from database or state.
 * @param {string} [fallback=""] - Optional fallback image URL if path is missing.
 * @returns {string} - The fully resolved image URL.
 */
export function getImageUrl(path, fallback = "") {
  if (!path || typeof path !== "string" || !path.trim()) {
    return fallback;
  }

  const cleanPath = path.trim();

  // Already a full external URL or inline data URI / blob URL
  if (
    cleanPath.startsWith("http://") ||
    cleanPath.startsWith("https://") ||
    cleanPath.startsWith("data:") ||
    cleanPath.startsWith("blob:")
  ) {
    return cleanPath;
  }

  // Frontend public assets (e.g. /assets/...) should not be prefixed with backend API_BASE_URL
  if (cleanPath.startsWith("/assets/") || cleanPath.startsWith("./assets/")) {
    return cleanPath;
  }

  // Ensure clean separation between API_BASE_URL and relative path
  const normalizedBase = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  const normalizedPath = cleanPath.startsWith("/")
    ? cleanPath
    : `/${cleanPath}`;

  return `${normalizedBase}${normalizedPath}`;
}

export default getImageUrl;
