import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WorkspaceProvider>
  </StrictMode>
);
