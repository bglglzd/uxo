import React, { useState, useRef, useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import { getTranslatedModelName } from "../../lib/utils/modelTranslation";
import { useModelStore } from "../../stores/modelStore";
import ModelStatusButton from "./ModelStatusButton";
import ModelDropdown from "./ModelDropdown";
import DownloadProgressDisplay from "./DownloadProgressDisplay";

import { ModelStateEvent } from "@/lib/types/events";

type ModelStatus =
  | "ready"
  | "loading"
  | "downloading"
  | "verifying"
  | "extracting"
  | "error"
  | "unloaded"
  | "none";

interface ModelSelectorProps {
  onError?: (error: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onError }) => {
  const { t } = useTranslation();
  const {
    models,
    currentModel,
    downloadProgress,
    downloadStats,
    verifyingModels,
    extractingModels,
    selectModel,
  } = useModelStore();

  const [modelStatus, setModelStatus] = useState<ModelStatus>("unloaded");
  const [modelError, setModelError] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [activeModelIndex, setActiveModelIndex] = useState(-1);
  // Track pending model switch for optimistic display
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const triggerId = `uxo-model-trigger-${dropdownId}`;
  const listboxId = `uxo-model-listbox-${dropdownId}`;

  const displayModelId = pendingModelId || currentModel;
  const downloadedModels = models.filter((model) => model.is_downloaded);
  const selectedModelIndex = downloadedModels.findIndex(
    (model) => model.id === displayModelId,
  );
  const effectiveActiveModelIndex = downloadedModels[activeModelIndex]
    ? activeModelIndex
    : selectedModelIndex >= 0
      ? selectedModelIndex
      : downloadedModels.length > 0
        ? 0
        : -1;

  useEffect(() => {
    if (!showModelDropdown || effectiveActiveModelIndex < 0) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`${listboxId}-option-${effectiveActiveModelIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [effectiveActiveModelIndex, listboxId, showModelDropdown]);

  // Check model status when currentModel changes
  useEffect(() => {
    const checkStatus = async () => {
      if (currentModel) {
        try {
          const statusResult = await commands.getTranscriptionModelStatus();
          if (statusResult.status === "ok") {
            setModelStatus(
              statusResult.data === currentModel ? "ready" : "unloaded",
            );
          }
        } catch {
          setModelStatus("error");
          setModelError("Failed to check model status");
        }
      } else {
        setModelStatus("none");
      }
    };
    checkStatus();
  }, [currentModel]);

  useEffect(() => {
    // Listen for model loading lifecycle events
    const modelStateUnlisten = listen<ModelStateEvent>(
      "model-state-changed",
      (event) => {
        const { event_type, error } = event.payload;
        switch (event_type) {
          case "loading_started":
            setModelStatus("loading");
            setModelError(null);
            break;
          case "loading_completed":
            setModelStatus("ready");
            setModelError(null);
            setPendingModelId(null);
            break;
          case "loading_failed":
            setModelStatus("error");
            setModelError(error || "Failed to load model");
            setPendingModelId(null);
            break;
          case "unloaded":
            setModelStatus("unloaded");
            setModelError(null);
            break;
        }
      },
    );

    // Auto-select model when download completes (fires after extraction too)
    const downloadCompleteUnlisten = listen<string>(
      "model-download-complete",
      (event) => {
        const modelId = event.payload;
        setTimeout(async () => {
          try {
            const isRecording = await commands.isRecording();
            if (!isRecording) {
              setPendingModelId(modelId);
              setModelError(null);
              setShowModelDropdown(false);
              const success = await selectModel(modelId);
              if (!success) {
                setPendingModelId(null);
              }
            }
          } catch {
            // Ignore errors in auto-select
          }
        }, 500);
      },
    );

    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !dropdownMenuRef.current?.contains(event.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      modelStateUnlisten.then((fn) => fn());
      downloadCompleteUnlisten.then((fn) => fn());
    };
  }, [selectModel]);

  const handleModelSelect = async (modelId: string) => {
    setPendingModelId(modelId);
    setModelError(null);
    setShowModelDropdown(false);
    dropdownTriggerRef.current?.focus();
    const success = await selectModel(modelId);
    if (!success) {
      setPendingModelId(null);
      setModelStatus("error");
      setModelError("Failed to switch model");
      onError?.("Failed to switch model");
    }
  };

  const openModelDropdown = (preferLast = false) => {
    setActiveModelIndex(
      selectedModelIndex >= 0
        ? selectedModelIndex
        : preferLast
          ? Math.max(0, downloadedModels.length - 1)
          : 0,
    );
    setShowModelDropdown(true);
  };

  const handleModelDropdownToggle = () => {
    if (showModelDropdown) {
      setShowModelDropdown(false);
    } else {
      openModelDropdown();
    }
  };

  const moveActiveModel = (direction: 1 | -1) => {
    if (downloadedModels.length === 0) return;
    setActiveModelIndex(
      (effectiveActiveModelIndex + direction + downloadedModels.length) %
        downloadedModels.length,
    );
  };

  const handleModelTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!showModelDropdown) {
          openModelDropdown(event.key === "ArrowUp");
        } else {
          moveActiveModel(event.key === "ArrowDown" ? 1 : -1);
        }
        break;
      case "Home":
      case "End":
        event.preventDefault();
        if (!showModelDropdown) setShowModelDropdown(true);
        setActiveModelIndex(
          event.key === "Home" ? 0 : Math.max(0, downloadedModels.length - 1),
        );
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (showModelDropdown && effectiveActiveModelIndex >= 0) {
          void handleModelSelect(
            downloadedModels[effectiveActiveModelIndex].id,
          );
        } else {
          openModelDropdown();
        }
        break;
      case "Escape":
        if (showModelDropdown) {
          event.preventDefault();
          setShowModelDropdown(false);
          dropdownTriggerRef.current?.focus();
        }
        break;
      case "Tab":
        setShowModelDropdown(false);
        break;
    }
  };

  const getModelDisplayText = (): string => {
    const verifyingKeys = Object.keys(verifyingModels);
    if (verifyingKeys.length > 0) {
      if (verifyingKeys.length === 1) {
        const modelId = verifyingKeys[0];
        const model = models.find((m) => m.id === modelId);
        const modelName = model
          ? getTranslatedModelName(model, t)
          : t("modelSelector.verifyingGeneric").replace("...", "");
        return t("modelSelector.verifying", { modelName });
      } else {
        return t("modelSelector.verifyingGeneric");
      }
    }

    const extractingKeys = Object.keys(extractingModels);
    if (extractingKeys.length > 0) {
      if (extractingKeys.length === 1) {
        const modelId = extractingKeys[0];
        const model = models.find((m) => m.id === modelId);
        const modelName = model
          ? getTranslatedModelName(model, t)
          : t("modelSelector.extractingGeneric").replace("...", "");
        return t("modelSelector.extracting", { modelName });
      } else {
        return t("modelSelector.extractingMultiple", {
          count: extractingKeys.length,
        });
      }
    }

    const progressValues = Object.values(downloadProgress);
    if (progressValues.length > 0) {
      if (progressValues.length === 1) {
        const progress = progressValues[0];
        const percentage = Math.max(
          0,
          Math.min(100, Math.round(progress.percentage)),
        );
        return t("modelSelector.downloading", { percentage });
      } else {
        return t("modelSelector.downloadingMultiple", {
          count: progressValues.length,
        });
      }
    }

    const currentModelInfo = models.find((m) => m.id === displayModelId);

    switch (modelStatus) {
      case "ready":
        return currentModelInfo
          ? getTranslatedModelName(currentModelInfo, t)
          : t("modelSelector.modelReady");
      case "loading":
        return currentModelInfo
          ? t("modelSelector.loading", {
              modelName: getTranslatedModelName(currentModelInfo, t),
            })
          : t("modelSelector.loadingGeneric");
      case "extracting":
        return currentModelInfo
          ? t("modelSelector.extracting", {
              modelName: getTranslatedModelName(currentModelInfo, t),
            })
          : t("modelSelector.extractingGeneric");
      case "error":
        return modelError || t("modelSelector.modelError");
      case "unloaded":
        return currentModelInfo
          ? getTranslatedModelName(currentModelInfo, t)
          : t("modelSelector.modelUnloaded");
      case "none":
        return t("modelSelector.noModelDownloadRequired");
      default:
        return currentModelInfo
          ? getTranslatedModelName(currentModelInfo, t)
          : t("modelSelector.modelUnloaded");
    }
  };

  // Derive display status from model status + store state
  const getDisplayStatus = (): ModelStatus => {
    if (Object.keys(verifyingModels).length > 0) return "verifying";
    if (Object.keys(extractingModels).length > 0) return "extracting";
    if (Object.keys(downloadProgress).length > 0) return "downloading";
    return modelStatus;
  };

  return (
    <>
      {/* Model Status and Switcher */}
      <div className="relative" ref={dropdownRef}>
        <ModelStatusButton
          ref={dropdownTriggerRef}
          triggerId={triggerId}
          listboxId={listboxId}
          activeDescendant={
            showModelDropdown && effectiveActiveModelIndex >= 0
              ? `${listboxId}-option-${effectiveActiveModelIndex}`
              : undefined
          }
          status={getDisplayStatus()}
          displayText={getModelDisplayText()}
          isDropdownOpen={showModelDropdown}
          onClick={handleModelDropdownToggle}
          onKeyDown={handleModelTriggerKeyDown}
        />

        {/* Model Dropdown */}
        {showModelDropdown && (
          <ModelDropdown
            activeIndex={effectiveActiveModelIndex}
            anchorRef={dropdownTriggerRef}
            triggerId={triggerId}
            listboxId={listboxId}
            popoverRef={dropdownMenuRef}
            models={models}
            currentModelId={displayModelId}
            onActiveIndexChange={setActiveModelIndex}
            onModelSelect={handleModelSelect}
          />
        )}
      </div>

      {/* Download Progress Bar for Models */}
      <DownloadProgressDisplay
        downloadProgress={downloadProgress}
        downloadStats={downloadStats}
      />
    </>
  );
};

export default ModelSelector;
