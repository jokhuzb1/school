import { createContext } from "react";
import type { ToastApi } from "../../../shared/hooks/useToastState";

export const ToastContext = createContext<ToastApi | null>(null);

