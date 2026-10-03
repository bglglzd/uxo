import React, { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "./Tooltip";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  descriptionMode = "tooltip",
  grouped = false,
  layout = "horizontal",
  disabled = false,
  tooltipPosition = "top",
}) => {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLButtonElement>(null);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTooltip]);

  const toggleTooltip = () => {
    setShowTooltip(!showTooltip);
  };

  const containerClasses = grouped
    ? "uxo-setting-row px-4 py-3"
    : "uxo-setting-row rounded-xl border border-border/70 bg-surface/60 px-4 py-3";

  if (layout === "stacked") {
    if (descriptionMode === "tooltip") {
      return (
        <div className={containerClasses}>
          <div className="mb-2.5 flex items-center gap-2">
            <h3
              className={`text-[13px] font-medium tracking-[-0.01em] ${disabled ? "opacity-50" : ""}`}
            >
              {title}
            </h3>
            <button
              type="button"
              ref={tooltipRef}
              className="relative flex h-6 w-6 items-center justify-center rounded-full text-mid-gray transition-colors hover:bg-logo-primary/10 hover:text-logo-primary"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={toggleTooltip}
              aria-label={t("common.moreInfo")}
              aria-expanded={showTooltip}
            >
              <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.8} />
              {showTooltip && (
                <Tooltip targetRef={tooltipRef} position="top">
                  <p className="text-sm text-center leading-relaxed">
                    {description}
                  </p>
                </Tooltip>
              )}
            </button>
          </div>
          <div className="w-full">{children}</div>
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        <div className="mb-2">
          <h3
            className={`text-[13px] font-medium tracking-[-0.01em] ${disabled ? "opacity-50" : ""}`}
          >
            {title}
          </h3>
          <p
            className={`text-sm text-mid-gray ${disabled ? "opacity-50" : ""}`}
          >
            {description}
          </p>
        </div>
        <div className="w-full">{children}</div>
      </div>
    );
  }

  // Horizontal layout (default)
  const horizontalContainerClasses = grouped
    ? "uxo-setting-row flex min-h-14 items-center justify-between gap-5 px-4 py-2.5"
    : "uxo-setting-row flex min-h-14 items-center justify-between gap-5 rounded-xl border border-border/70 bg-surface/60 px-4 py-2.5";

  if (descriptionMode === "tooltip") {
    return (
      <div className={horizontalContainerClasses}>
        <div className="max-w-2/3">
          <div className="flex items-center gap-2">
            <h3
              className={`text-[13px] font-medium tracking-[-0.01em] ${disabled ? "opacity-50" : ""}`}
            >
              {title}
            </h3>
            <button
              type="button"
              ref={tooltipRef}
              className="relative flex h-6 w-6 items-center justify-center rounded-full text-mid-gray transition-colors hover:bg-logo-primary/10 hover:text-logo-primary"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={toggleTooltip}
              aria-label={t("common.moreInfo")}
              aria-expanded={showTooltip}
            >
              <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.8} />
              {showTooltip && (
                <Tooltip targetRef={tooltipRef} position={tooltipPosition}>
                  <p className="text-sm text-center leading-relaxed">
                    {description}
                  </p>
                </Tooltip>
              )}
            </button>
          </div>
        </div>
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <div className={horizontalContainerClasses}>
      <div className="max-w-2/3">
        <h3
          className={`text-[13px] font-medium tracking-[-0.01em] ${disabled ? "opacity-50" : ""}`}
        >
          {title}
        </h3>
        <p className={`text-sm text-mid-gray ${disabled ? "opacity-50" : ""}`}>
          {description}
        </p>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
};
