import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist/wght.css";
import "@fontsource/barlow-condensed/latin-900.css";
import { Landing } from "./Landing";
import { Workspace } from "./Workspace";
import { Studio } from "./music/Studio";
import { MusicLanding } from "./music/MusicLanding";
import { appPath } from "./paths";
import "./styles.css";

const path = location.pathname.replace(/\/$/, "");
const isAudit = path === appPath("audit") || path === appPath("audit/index.html");
const isFieldGuide = path === appPath("field-guide") || path === appPath("field-guide/index.html");
if (isAudit || isFieldGuide) document.title = "Waypin — Make barriers visible";
const app = isAudit
  ? <Workspace />
  : isFieldGuide ? <Landing /> : path === appPath("studio") || path === appPath("studio/index.html") ? <Studio /> : <MusicLanding />;
createRoot(document.getElementById("root")!).render(app);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(appPath("sw.js")).catch(() => undefined);
  });
}
