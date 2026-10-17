import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted fonts (latin subset): no request to Google, no visitor IP shared with a third party
import "@fontsource/archivo/latin-500.css";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/archivo/latin-800.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
