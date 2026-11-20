import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app";
import { API_BASE_URL } from "./api/axiosInstance.js";
import "./style.css";

export { API_BASE_URL };

if (typeof window !== "undefined") {
  window.API_BASE_URL = API_BASE_URL;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
