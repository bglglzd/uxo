import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "./SettingContainer";

interface TextDisplayProps {
  label: string;
  description: string;
  value: string;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  placeholder?: string;
  copyable?: boolean;
  monospace?: boolean;
  onCopy?: (value: string) => void;
}

export const TextDisplay: React.FC<TextDisplayProps> = ({
  label,
  description,
  value,
  descriptionMode = "tooltip",
  grouped = false,
  placeholder,
  copyable = false,
  monospace = false,
  onCopy,
}) => {
  const { t } = useTranslation();
  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = async () => {
    if (!value || !copyable) return;

    try {
      await navigator.clipboard.writeText(value);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
      if (onCopy) {
        onCopy(value);
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const displayValue = value || placeholder || t("common.notAvailable");
  const textClasses = monospace ? "font-mono break-all" : "break-words";

  return (
    <SettingContainer
      title={label}
      description={description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="stacked"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={`flex min-h-9 items-center rounded-xl border border-border bg-surface-raised/75 px-3 text-xs text-text shadow-sm ${textClasses} ${!value ? "opacity-60" : ""}`}
          >
            {displayValue}
          </div>
        </div>
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="flex min-h-9 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-raised px-2 py-1 text-xs font-medium text-text shadow-sm transition-all duration-200 hover:border-logo-primary/55 hover:bg-logo-primary/10 hover:text-logo-primary focus:outline-none"
            title={t("common.copyToClipboard")}
            aria-label={t("common.copyToClipboard")}
          >
            {showCopied ? (
              <div className="flex items-center space-x-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              t("common.copy")
            )}
          </button>
        )}
      </div>
    </SettingContainer>
  );
};
