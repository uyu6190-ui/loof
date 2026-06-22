import React from "react";
import { createRoot } from "react-dom/client";
import "./storage.js";
import App from "./App.jsx";

// このリポジトリはService Workerを登録しない。過去のPWA配信で残ったWorkerだけを解除し、
// PWAと通常ブラウザーで別々の古いJSを実行し続けないようにする。
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;
    await Promise.all(registrations.map(registration => registration.unregister()));
    if (navigator.serviceWorker.controller && !sessionStorage.getItem("loof.sw-cleaned")) {
      sessionStorage.setItem("loof.sw-cleaned", "1");
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
