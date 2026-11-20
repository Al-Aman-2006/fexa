import axios from "axios";

/**
 * Centralized Axios API Client for FEXA
 *
 * Configured with:
 * - baseURL from environment variable (VITE_API_BASE_URL) or dynamic host fallback
 * - withCredentials: true (to maintain cookie-based authentication sessions)
 * - Default application/json header for structured payloads
 * - Request interceptor:
 *     - Strips Content-Type for FormData requests so Axios/browser computes multipart boundary
 *     - Enforces strict token separation: adminToken for /admin, customer token for user endpoints
 * - Response interceptor:
 *     - Graceful handling of network errors
 *     - Selective 401 token cleanup without redirect loops or session-check interference
 */
const rawEnvUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE_URL : undefined;

export const API_BASE_URL = rawEnvUrl
  ? rawEnvUrl.replace(/\/+$/, "")
  : typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : "http://localhost:5000";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach authentication token & safely manage headers
axiosInstance.interceptors.request.use(
  (config) => {
    // Preserve withCredentials on every request for cookie transmission
    config.withCredentials = true;

    // For FormData requests (file uploads), remove Content-Type so the browser/Axios generates
    // the correct 'multipart/form-data; boundary=----WebKitFormBoundary...' header automatically
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === "function") {
          config.headers.delete("Content-Type");
          config.headers.delete("content-type");
        } else {
          delete config.headers["Content-Type"];
          delete config.headers["content-type"];
        }
      }
    }

    // Attach Authorization header if not explicitly set
    const hasAuthHeader =
      config.headers &&
      (config.headers.Authorization ||
        config.headers.authorization ||
        (typeof config.headers.get === "function" && config.headers.get("Authorization")));

    if (!hasAuthHeader) {
      const adminToken = localStorage.getItem("adminToken");
      const userToken = localStorage.getItem("token");

      // Enforce strict token separation: admin endpoints use adminToken, customer endpoints use userToken
      const isAdminEndpoint = config.url && config.url.includes("/admin");
      const token = isAdminEndpoint ? adminToken : userToken;

      if (token) {
        if (typeof config.headers?.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Centralized error handling & selective session cleanup
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      // Network error, server unreachable, or CORS failure - do not purge tokens
      console.error(
        "Network Error: Unable to reach the server. Please check your connection.",
        error.message
      );
    } else if (error.response.status === 401) {
      const url = (error.config?.url || "").toLowerCase();

      // Passive session validation endpoints and login/register attempts MUST NOT trigger token purging
      // (Auth contexts handle unauthenticated state gracefully during initial checks)
      const isSessionOrAuthFlow =
        url.includes("/auth/session") ||
        url.endsWith("/session") ||
        url.includes("/login") ||
        url.includes("/register");

      if (!isSessionOrAuthFlow) {
        const isAdminEndpoint = url.includes("/admin");

        if (isAdminEndpoint) {
          if (localStorage.getItem("adminToken")) {
            console.warn("Admin session expired (401). Purging stale adminToken.");
            localStorage.removeItem("adminToken");
          }
        } else {
          if (localStorage.getItem("token")) {
            console.warn("Customer session expired (401). Purging stale user token.");
            localStorage.removeItem("token");
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export { axiosInstance };
export default axiosInstance;
