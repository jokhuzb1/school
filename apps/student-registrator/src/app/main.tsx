import ReactDOM from "react-dom/client";
import App from "./App";
import { clearApiDebugEntries, getApiDebugEntries, getApiDebugReport } from "../api";
import "../index.css";

declare global {
  interface Window {
    __registratorDebug?: {
      getApiDebugEntries: (limit?: number) => ReturnType<typeof getApiDebugEntries>;
      getApiDebugReport: (limit?: number) => string;
      clearApiDebugEntries: () => void;
    };
  }
}

window.__registratorDebug = {
  getApiDebugEntries,
  getApiDebugReport,
  clearApiDebugEntries,
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

