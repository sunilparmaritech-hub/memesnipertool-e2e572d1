/**
 * Toast compatibility shim
 * Routes all legacy shadcn toast calls through Sonner for a unified notification system.
 */
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: React.ReactNode;
  duration?: number;
}

function toast(props: ToastProps) {
  const { title, description, variant, duration } = props;
  const message = title || "Notification";
  const opts: { description?: string; duration?: number } = {};
  if (description) opts.description = description;
  if (duration) opts.duration = duration;

  if (variant === "destructive") {
    sonnerToast.error(message, opts);
  } else if (variant === "success") {
    sonnerToast.success(message, opts);
  } else {
    sonnerToast(message, opts);
  }

  return { id: "", dismiss: () => {}, update: () => {} };
}

function useToast() {
  return {
    toast,
    dismiss: () => {},
    toasts: [] as any[],
  };
}

export { useToast, toast };
