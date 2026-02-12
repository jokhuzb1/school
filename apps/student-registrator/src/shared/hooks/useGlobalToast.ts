import { useContext } from "react";
import { ToastContext } from "../../app/providers/toast/ToastContext";

export function useGlobalToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useGlobalToast must be used within ToastContext.Provider");
  }
  return context;
}

