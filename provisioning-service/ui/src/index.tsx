import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Container } from "./Container";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/accounts/:accountId/projects/:projectId/deployments/:deploymentId"
          element={<Container />}
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
