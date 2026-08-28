import React from "react";
import { useTranslation } from "react-i18next";
import type { ModelInfo } from "@/bindings";
import { AnchoredPopover } from "@/components/ui/AnchoredPopover";
import {
  getTranslatedModelName,
  getTranslatedModelDescription,
} from "../../lib/utils/modelTranslation";

interface ModelDropdownProps {
  activeIndex: number;
  anchorRef: React.RefObject<HTMLElement>;
  listboxId: string;
  models: ModelInfo[];
  currentModelId: string;
  onActiveIndexChange: (index: number) => void;
  onModelSelect: (modelId: string) => void;
  popoverRef: React.RefObject<HTMLDivElement>;
  triggerId: string;
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  activeIndex,
  anchorRef,
  listboxId,
  models,
  currentModelId,
  onActiveIndexChange,
  onModelSelect,
  popoverRef,
  triggerId,
}) => {
  const { t } = useTranslation();
  const downloadedModels = models.filter((m) => m.is_downloaded);

  const handleModelClick = (modelId: string) => {
    onModelSelect(modelId);
  };

  return (
    <AnchoredPopover
      anchorRef={anchorRef}
      popoverRef={popoverRef}
      open
      id={listboxId}
      preferredSide="top"
      width={256}
      maxHeight={Math.floor(window.innerHeight * 0.6)}
      role="listbox"
      ariaLabelledBy={triggerId}
      className="overflow-y-auto rounded-xl border border-border bg-surface-glass py-2 shadow-xl backdrop-blur-xl"
    >
      {downloadedModels.length > 0 ? (
        <div>
          {downloadedModels.map((model, index) => (
            <div
              key={model.id}
              id={`${listboxId}-option-${index}`}
              onClick={() => handleModelClick(model.id)}
              onMouseEnter={() => onActiveIndexChange(index)}
              tabIndex={-1}
              role="option"
              aria-selected={currentModelId === model.id}
              className={`w-full px-3 py-2 text-start hover:bg-mid-gray/10 transition-colors cursor-pointer focus:outline-none ${
                activeIndex === index
                  ? "bg-logo-primary/10 ring-1 ring-inset ring-logo-primary/35"
                  : ""
              } ${
                currentModelId === model.id
                  ? "bg-logo-primary/10 text-logo-primary"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text/80">
                    {getTranslatedModelName(model, t)}
                    {model.is_custom && (
                      <span className="ms-1.5 text-[10px] font-medium text-text/40 uppercase">
                        {t("modelSelector.custom")}
                      </span>
                    )}
                    {model.supports_streaming && (
                      <span className="ms-1.5 text-[10px] font-medium text-logo-primary/70 uppercase">
                        {t("modelSelector.streaming")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text/40 italic pe-4">
                    {getTranslatedModelDescription(model, t)}
                  </div>
                </div>
                {currentModelId === model.id && (
                  <div className="text-xs text-logo-primary">
                    {t("modelSelector.active")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-text/60">
          {t("modelSelector.noModelsAvailable")}
        </div>
      )}
    </AnchoredPopover>
  );
};

export default ModelDropdown;
