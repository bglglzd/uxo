import React from "react";

type ModelStatus =
  | "ready"
  | "loading"
  | "downloading"
  | "verifying"
  | "extracting"
  | "error"
  | "unloaded"
  | "none";

interface ModelStatusButtonProps {
  activeDescendant?: string;
  status: ModelStatus;
  displayText: string;
  isDropdownOpen: boolean;
  listboxId: string;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  triggerId: string;
  className?: string;
}

const ModelStatusButton = React.forwardRef<
  HTMLButtonElement,
  ModelStatusButtonProps
>(function ModelStatusButton(
  {
    activeDescendant,
    status,
    displayText,
    isDropdownOpen,
    listboxId,
    onClick,
    onKeyDown,
    triggerId,
    className = "",
  },
  ref,
) {
  const getStatusColor = (status: ModelStatus): string => {
    switch (status) {
      case "ready":
        return "bg-logo-primary";
      case "loading":
        return "bg-warning animate-pulse";
      case "downloading":
        return "bg-logo-primary animate-pulse";
      case "verifying":
        return "bg-warning animate-pulse";
      case "extracting":
        return "bg-warning animate-pulse";
      case "error":
        return "bg-error";
      case "unloaded":
        return "bg-mid-gray/60";
      case "none":
        return "bg-error";
      default:
        return "bg-mid-gray/60";
    }
  };

  return (
    <button
      ref={ref}
      id={triggerId}
      type="button"
      role="combobox"
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-2 hover:text-text/80 transition-colors ${className}`}
      title={displayText}
      aria-label={displayText}
      aria-expanded={isDropdownOpen}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-activedescendant={activeDescendant}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="max-w-28 truncate">{displayText}</span>
      <svg
        className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
});

ModelStatusButton.displayName = "ModelStatusButton";

export default ModelStatusButton;
