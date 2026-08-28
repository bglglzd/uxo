import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

export const Input: React.FC<InputProps> = ({
  className = "",
  variant = "default",
  disabled,
  ...props
}) => {
  const baseClasses =
    "rounded-xl border border-border bg-surface-raised/75 px-2 py-1 text-start text-sm font-medium text-text shadow-sm transition-all duration-200 placeholder:text-mid-gray/70";

  const interactiveClasses = disabled
    ? "cursor-not-allowed border-border/50 bg-surface/60 opacity-55"
    : "hover:border-logo-primary/45 hover:bg-surface-raised focus:border-logo-primary focus:bg-surface-raised focus:outline-none";

  const variantClasses = {
    default: "px-3 py-2",
    compact: "px-2.5 py-1.5",
  } as const;

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
};
