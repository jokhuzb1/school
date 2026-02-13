import type { Toast as ToastType } from '../../types';
import { Icons } from './Icons';

interface ToastContainerProps {
  toasts: ToastType[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`} role="alert">
          {toast.type === "success" ? <Icons.Check /> : <Icons.AlertCircle />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
