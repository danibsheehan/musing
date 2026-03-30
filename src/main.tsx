import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import "./index.css";
import App from "./App.tsx";

const routerBasename = (() => {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return undefined;
  return base.replace(/\/$/, "") || undefined;
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceProvider>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </WorkspaceProvider>
  </StrictMode>
);
