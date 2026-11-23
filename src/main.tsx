import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist/wght.css";
import "@fontsource/barlow-condensed/latin-900.css";
import { Landing } from "./Landing";
import { Workspace } from "./Workspace";
import { appPath } from "./paths";
import "./styles.css";

createRoot(document.getElementById("root")!).render(location.pathname.startsWith(appPath("audit")) ? <Workspace /> : <Landing />);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(appPath("sw.js")).catch(() => undefined);
  });
}
