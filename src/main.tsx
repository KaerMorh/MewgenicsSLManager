import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { I18nProvider } from "./i18n";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
      <Toaster position="top-center" richColors />
    </I18nProvider>
  </React.StrictMode>
);
