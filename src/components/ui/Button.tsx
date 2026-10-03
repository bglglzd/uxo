import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "warning"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "cursor-pointer rounded-xl border font-medium shadow-sm transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none active:translate-y-px";

  const variantClasses = {
    primary:
      "bg-background-ui text-on-accent border-background-ui hover:brightness-110 hover:shadow-md",
    "primary-soft":
      "text-logo-primary bg-logo-primary/10 border-logo-primary/15 hover:bg-logo-primary/20 hover:border-logo-primary/30",
    secondary:
      "bg-surface-raised/75 border-border text-text hover:bg-logo-primary/10 hover:border-logo-primary/35",
    // Secondary's neutral resting look, but warning actions use the semantic
    // status token so they remain distinct from the brand accent.
    warning:
      "text-text bg-surface-raised/75 border-border hover:bg-warning/10 hover:border-warning/55",
    danger: "text-on-accent bg-error border-error hover:brightness-110",
    "danger-ghost":
      "text-error border-transparent shadow-none hover:bg-error/10",
    ghost:
      "text-current border-transparent shadow-none hover:bg-logo-primary/10 hover:border-logo-primary/20",
  };

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-4 py-1.5 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
