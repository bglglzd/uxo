import React from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

type AlertVariant = "error" | "warning" | "info" | "success";

interface AlertProps {
  variant?: AlertVariant;
  /** When true, removes rounded corners for use inside containers */
  contained?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<
  AlertVariant,
  { container: string; icon: string; text: string }
> = {
  error: {
    container: "border-error/35 bg-error/10",
    icon: "text-error",
    text: "text-text",
  },
  warning: {
    container: "border-warning/35 bg-warning/10",
    icon: "text-warning",
    text: "text-text",
  },
  info: {
    container: "border-logo-primary/35 bg-logo-primary/10",
    icon: "text-logo-primary",
    text: "text-text",
  },
  success: {
    container: "border-logo-primary/35 bg-logo-primary/10",
    icon: "text-logo-primary",
    text: "text-text",
  },
};

const variantIcons: Record<AlertVariant, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

export const Alert: React.FC<AlertProps> = ({
  variant = "error",
  contained = false,
  children,
  className = "",
}) => {
  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={`flex items-start gap-3 border p-4 shadow-sm backdrop-blur-sm ${styles.container} ${contained ? "" : "rounded-xl"} ${className}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
      <p className={`text-sm ${styles.text}`}>{children}</p>
    </div>
  );
};
