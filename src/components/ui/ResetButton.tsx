import React from "react";
import ResetIcon from "../icons/ResetIcon";

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({ onClick, disabled = false, className = "", ariaLabel, children }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`rounded-lg border border-transparent p-1.5 transition-all duration-200 focus:outline-none ${
        disabled
          ? "opacity-50 cursor-not-allowed text-text/40"
          : "cursor-pointer text-mid-gray hover:border-logo-primary/35 hover:bg-logo-primary/10 hover:text-logo-primary active:translate-y-[1px]"
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children ?? <ResetIcon />}
    </button>
  ),
);
