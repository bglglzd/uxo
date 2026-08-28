import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "compact";
}

export const Textarea: React.FC<TextareaProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "resize-y rounded-xl border border-border bg-surface-raised/75 px-3 py-2 text-start text-sm font-medium text-text shadow-sm transition-all duration-200 placeholder:text-mid-gray/70 hover:border-logo-primary/45 hover:bg-surface-raised focus:border-logo-primary focus:bg-surface-raised focus:outline-none disabled:cursor-not-allowed disabled:opacity-55";

  const variantClasses = {
    default: "min-h-[100px]",
    compact: "min-h-[80px] px-2.5 py-1.5",
  };

  return (
    <textarea
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
