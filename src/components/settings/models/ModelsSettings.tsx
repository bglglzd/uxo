import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  AudioLines,
  ChevronDown,
  Globe,
  Languages,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ModelCardStatus } from "@/components/onboarding";
import { ModelCard } from "@/components/onboarding";
import { useModelStore } from "@/stores/modelStore";
import {
  getLanguageLabel,
  MODEL_CAPABILITY_LANGUAGES,
  supportsLanguageCode,
} from "@/lib/constants/languages.ts";
import type { ModelInfo } from "@/bindings";
import {
  AnchoredPopover,
  focusAdjacentControl,
} from "@/components/ui/AnchoredPopover";

// check if model supports a language based on its supported_languages list
const modelSupportsLanguage = (model: ModelInfo, langCode: string): boolean => {
  return supportsLanguageCode(model.supported_languages, langCode);
};

// Legacy models are the blob (Url-sourced) .bin/ONNX downloads, superseded by
// the catalog GGUFs. They stay runnable when already on disk, but we no longer
// advertise the download.
const isLegacyModel = (model: ModelInfo): boolean =>
  typeof model.source === "object" && "Url" in model.source;

export const ModelsSettings: React.FC = () => {
  const { t } = useTranslation();
  const [switchingModelId, setSwitchingModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStreaming, setFilterStreaming] = useState(false);
  const [filterTranslation, setFilterTranslation] = useState(false);
  const [languageFilter, setLanguageFilter] = useState("all");
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [activeLanguageIndex, setActiveLanguageIndex] = useState(0);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const languageDropdownMenuRef = useRef<HTMLDivElement>(null);
  const languageSearchInputRef = useRef<HTMLInputElement>(null);
  const languageDropdownId = useId();
  const languageTriggerId = `uxo-model-language-trigger-${languageDropdownId}`;
  const languageDialogId = `uxo-model-language-dialog-${languageDropdownId}`;
  const languageListboxId = `uxo-model-language-listbox-${languageDropdownId}`;
  const {
    models,
    currentModel,
    downloadingModels,
    downloadProgress,
    downloadStats,
    verifyingModels,
    extractingModels,
    loading,
    isRescanning,
    downloadModel,
    cancelDownload,
    selectModel,
    deleteModel,
    rescanLocalModels,
  } = useModelStore();

  // click outside handler for language dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        languageDropdownRef.current &&
        !languageDropdownRef.current.contains(event.target as Node) &&
        !languageDropdownMenuRef.current?.contains(event.target as Node)
      ) {
        setLanguageDropdownOpen(false);
        setLanguageSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // focus search input when dropdown opens
  useEffect(() => {
    if (languageDropdownOpen && languageSearchInputRef.current) {
      languageSearchInputRef.current.focus();
    }
  }, [languageDropdownOpen]);

  // filtered languages for dropdown (exclude "auto")
  const filteredLanguages = useMemo(() => {
    return MODEL_CAPABILITY_LANGUAGES.filter((lang) =>
      lang.label.toLowerCase().includes(languageSearch.toLowerCase()),
    );
  }, [languageSearch]);
  const selectedLanguageIndex =
    languageFilter === "all"
      ? 0
      : filteredLanguages.findIndex((lang) => lang.value === languageFilter) +
        1;
  const languageOptionCount = filteredLanguages.length + 1;
  const effectiveActiveLanguageIndex =
    activeLanguageIndex >= 0 && activeLanguageIndex < languageOptionCount
      ? activeLanguageIndex
      : selectedLanguageIndex >= 0
        ? selectedLanguageIndex
        : 0;

  useEffect(() => {
    if (!languageDropdownOpen) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `${languageListboxId}-option-${effectiveActiveLanguageIndex}`,
        )
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [effectiveActiveLanguageIndex, languageDropdownOpen, languageListboxId]);

  // Get selected language label
  const selectedLanguageLabel = useMemo(() => {
    if (languageFilter === "all") {
      return t("settings.models.filters.allLanguages");
    }
    return getLanguageLabel(languageFilter) || "";
  }, [languageFilter, t]);

  const closeLanguageDropdown = (restoreFocus = false) => {
    setLanguageDropdownOpen(false);
    setLanguageSearch("");
    if (restoreFocus) languageDropdownTriggerRef.current?.focus();
  };

  const openLanguageDropdown = (preferLast = false) => {
    setLanguageSearch("");
    const selectedIndex =
      languageFilter === "all"
        ? 0
        : MODEL_CAPABILITY_LANGUAGES.findIndex(
            (lang) => lang.value === languageFilter,
          ) + 1;
    setActiveLanguageIndex(
      selectedIndex >= 0
        ? selectedIndex
        : preferLast
          ? MODEL_CAPABILITY_LANGUAGES.length
          : 0,
    );
    setLanguageDropdownOpen(true);
  };

  const selectLanguageFilter = (value: string) => {
    setLanguageFilter(value);
    closeLanguageDropdown(true);
  };

  const moveActiveLanguage = (direction: 1 | -1) => {
    setActiveLanguageIndex(
      (effectiveActiveLanguageIndex + direction + languageOptionCount) %
        languageOptionCount,
    );
  };

  const selectActiveLanguage = () => {
    if (effectiveActiveLanguageIndex === 0) {
      selectLanguageFilter("all");
      return;
    }
    const language = filteredLanguages[effectiveActiveLanguageIndex - 1];
    if (language) selectLanguageFilter(language.value);
  };

  const handleLanguageSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        moveActiveLanguage(event.key === "ArrowDown" ? 1 : -1);
        break;
      case "Home":
      case "End":
        event.preventDefault();
        setActiveLanguageIndex(
          event.key === "Home" ? 0 : languageOptionCount - 1,
        );
        break;
      case "Enter":
        event.preventDefault();
        selectActiveLanguage();
        break;
      case "Escape":
        event.preventDefault();
        closeLanguageDropdown(true);
        break;
      case "Tab":
        event.preventDefault();
        closeLanguageDropdown();
        focusAdjacentControl(
          languageDropdownTriggerRef.current,
          event.shiftKey,
        );
        break;
    }
  };

  const handleLanguageTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      openLanguageDropdown(event.key === "ArrowUp" || event.key === "End");
      if (event.key === "Home") setActiveLanguageIndex(0);
      if (event.key === "End") {
        setActiveLanguageIndex(MODEL_CAPABILITY_LANGUAGES.length);
      }
    } else if (event.key === "Escape" && languageDropdownOpen) {
      event.preventDefault();
      closeLanguageDropdown(true);
    } else if (event.key === "Tab") {
      closeLanguageDropdown();
    }
  };

  const getModelStatus = (modelId: string): ModelCardStatus => {
    if (modelId in extractingModels) {
      return "extracting";
    }
    if (modelId in verifyingModels) {
      return "verifying";
    }
    if (modelId in downloadingModels) {
      return "downloading";
    }
    if (switchingModelId === modelId) {
      return "switching";
    }
    if (modelId === currentModel) {
      return "active";
    }
    const model = models.find((m: ModelInfo) => m.id === modelId);
    if (model?.is_downloaded) {
      return "available";
    }
    return "downloadable";
  };

  const getDownloadProgress = (modelId: string): number | undefined => {
    const progress = downloadProgress[modelId];
    return progress?.percentage;
  };

  const getDownloadSpeed = (modelId: string): number | undefined => {
    const stats = downloadStats[modelId];
    return stats?.speed;
  };

  const handleModelSelect = async (modelId: string) => {
    setSwitchingModelId(modelId);
    try {
      await selectModel(modelId);
    } finally {
      setSwitchingModelId(null);
    }
  };

  const handleModelDownload = async (modelId: string) => {
    await downloadModel(modelId);
  };

  const handleModelDelete = async (modelId: string) => {
    const model = models.find((m: ModelInfo) => m.id === modelId);
    const modelName = model?.name || modelId;
    const isActive = modelId === currentModel;

    const confirmed = await ask(
      isActive
        ? t("settings.models.deleteActiveConfirm", { modelName })
        : t("settings.models.deleteConfirm", { modelName }),
      {
        title: t("settings.models.deleteTitle"),
        kind: "warning",
      },
    );

    if (confirmed) {
      try {
        await deleteModel(modelId);
      } catch (err) {
        console.error(`Failed to delete model ${modelId}:`, err);
      }
    }
  };

  const handleModelCancel = async (modelId: string) => {
    try {
      await cancelDownload(modelId);
    } catch (err) {
      console.error(`Failed to cancel download for ${modelId}:`, err);
    }
  };

  // Filter models by search query (name + description), language filter, and toggles
  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((model: ModelInfo) => {
      // Hide deprecated legacy (.bin/ONNX) downloads unless already on disk.
      if (isLegacyModel(model) && !model.is_downloaded) return false;
      if (languageFilter !== "all") {
        if (!modelSupportsLanguage(model, languageFilter)) return false;
      }
      if (filterStreaming && !model.supports_streaming) return false;
      if (filterTranslation && !model.supports_translation) return false;

      if (q) {
        const haystack = `${model.name} ${model.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [models, languageFilter, filterStreaming, filterTranslation, searchQuery]);

  // Split filtered models into downloaded (including custom) and available sections
  const { downloadedModels, availableModels } = useMemo(() => {
    const downloaded: ModelInfo[] = [];
    const available: ModelInfo[] = [];

    for (const model of filteredModels) {
      if (
        model.is_custom ||
        model.is_downloaded ||
        model.id in downloadingModels ||
        model.id in extractingModels
      ) {
        downloaded.push(model);
      } else {
        available.push(model);
      }
    }

    // Sort: active model first, then non-custom, then custom at the bottom
    downloaded.sort((a, b) => {
      if (a.id === currentModel) return -1;
      if (b.id === currentModel) return 1;
      if (a.is_custom !== b.is_custom) return a.is_custom ? 1 : -1;
      return 0;
    });

    return {
      downloadedModels: downloaded,
      availableModels: available,
    };
  }, [filteredModels, downloadingModels, extractingModels, currentModel]);

  if (loading) {
    return (
      <div className="max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-logo-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">
          {t("settings.models.title")}
        </h2>
        <p className="text-sm text-text/60">
          {t("settings.models.description")}
        </p>
      </div>

      {/* Search bar — filter the catalog by name or description */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("settings.models.searchPlaceholder")}
          className="w-full ps-9 pe-3 py-2 text-sm bg-mid-gray/10 border border-mid-gray/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-logo-primary placeholder:text-text/40"
        />
      </div>

      <div className="space-y-6">
        {/* Downloaded Models Section — header always visible so filter stays accessible */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text/60">
              {t("settings.models.yourModels")}
            </h2>
            <div className="flex items-center gap-2">
              {/* Rescan local sources for models added outside UXO */}
              <button
                type="button"
                onClick={() => rescanLocalModels()}
                disabled={isRescanning}
                title={t("settings.models.rescan.tooltip")}
                aria-label={t("settings.models.rescan.tooltip")}
                className="flex items-center justify-center w-8 h-8 text-sm font-medium rounded-lg bg-mid-gray/10 text-text/60 hover:bg-mid-gray/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRescanning ? "animate-spin" : ""}`}
                />
              </button>

              {/* Vertical divider separating action from filters */}
              <div className="h-4 w-px bg-mid-gray/30 mx-0.5" />
              <button
                type="button"
                onClick={() => setFilterStreaming((enabled) => !enabled)}
                title={t("settings.models.filters.streaming")}
                aria-label={t("settings.models.filters.streaming")}
                aria-pressed={filterStreaming}
                className={`flex items-center justify-center w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                  filterStreaming
                    ? "bg-logo-primary/20 text-logo-primary hover:bg-logo-primary/30"
                    : "bg-mid-gray/10 text-text/60 hover:bg-mid-gray/20"
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setFilterTranslation((enabled) => !enabled)}
                title={t("settings.models.filters.translation")}
                aria-label={t("settings.models.filters.translation")}
                aria-pressed={filterTranslation}
                className={`flex items-center justify-center w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                  filterTranslation
                    ? "bg-logo-primary/20 text-logo-primary hover:bg-logo-primary/30"
                    : "bg-mid-gray/10 text-text/60 hover:bg-mid-gray/20"
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
              </button>
              {/* Language filter dropdown */}
              <div className="relative" ref={languageDropdownRef}>
                <button
                  ref={languageDropdownTriggerRef}
                  id={languageTriggerId}
                  type="button"
                  onClick={() => {
                    if (languageDropdownOpen) closeLanguageDropdown();
                    else openLanguageDropdown();
                  }}
                  onKeyDown={handleLanguageTriggerKeyDown}
                  aria-expanded={languageDropdownOpen}
                  aria-haspopup="dialog"
                  aria-controls={languageDialogId}
                  className={`flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-lg transition-colors ${
                    languageFilter !== "all"
                      ? "bg-logo-primary/20 text-logo-primary"
                      : "bg-mid-gray/10 text-text/60 hover:bg-mid-gray/20"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">
                    {selectedLanguageLabel}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      languageDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnchoredPopover
                  anchorRef={languageDropdownTriggerRef}
                  popoverRef={languageDropdownMenuRef}
                  open={languageDropdownOpen}
                  id={languageDialogId}
                  align="end"
                  width={224}
                  role="dialog"
                  ariaLabelledBy={languageTriggerId}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-glass shadow-xl backdrop-blur-xl"
                >
                  <div className="p-2 border-b border-mid-gray/40">
                    <input
                      ref={languageSearchInputRef}
                      type="text"
                      role="combobox"
                      value={languageSearch}
                      onChange={(event) => {
                        setLanguageSearch(event.target.value);
                        setActiveLanguageIndex(0);
                      }}
                      onKeyDown={handleLanguageSearchKeyDown}
                      placeholder={t(
                        "settings.general.language.searchPlaceholder",
                      )}
                      aria-labelledby={languageTriggerId}
                      aria-expanded={true}
                      aria-autocomplete="list"
                      aria-controls={languageListboxId}
                      aria-activedescendant={`${languageListboxId}-option-${effectiveActiveLanguageIndex}`}
                      className="w-full px-2 py-1 text-sm bg-mid-gray/10 border border-mid-gray/40 rounded-md focus:outline-none focus:ring-1 focus:ring-logo-primary"
                    />
                  </div>
                  <div
                    id={languageListboxId}
                    role="listbox"
                    aria-labelledby={languageTriggerId}
                    className="min-h-0 flex-1 overflow-y-auto"
                  >
                    <button
                      id={`${languageListboxId}-option-0`}
                      type="button"
                      role="option"
                      aria-selected={languageFilter === "all"}
                      tabIndex={-1}
                      onMouseEnter={() => setActiveLanguageIndex(0)}
                      onClick={() => selectLanguageFilter("all")}
                      className={`w-full px-3 py-1.5 text-sm text-start transition-colors ${
                        effectiveActiveLanguageIndex === 0
                          ? "bg-logo-primary/10 ring-1 ring-inset ring-logo-primary/35"
                          : ""
                      } ${
                        languageFilter === "all"
                          ? "bg-logo-primary/20 text-logo-primary font-semibold"
                          : "hover:bg-mid-gray/10"
                      }`}
                    >
                      {t("settings.models.filters.allLanguages")}
                    </button>
                    {filteredLanguages.map((lang, index) => (
                      <button
                        key={lang.value}
                        id={`${languageListboxId}-option-${index + 1}`}
                        type="button"
                        role="option"
                        aria-selected={languageFilter === lang.value}
                        tabIndex={-1}
                        onMouseEnter={() => setActiveLanguageIndex(index + 1)}
                        onClick={() => selectLanguageFilter(lang.value)}
                        className={`w-full px-3 py-1.5 text-sm text-start transition-colors ${
                          effectiveActiveLanguageIndex === index + 1
                            ? "bg-logo-primary/10 ring-1 ring-inset ring-logo-primary/35"
                            : ""
                        } ${
                          languageFilter === lang.value
                            ? "bg-logo-primary/20 text-logo-primary font-semibold"
                            : "hover:bg-mid-gray/10"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                    {filteredLanguages.length === 0 && (
                      <div className="px-3 py-2 text-sm text-text/50 text-center">
                        {t("settings.general.language.noResults")}
                      </div>
                    )}
                  </div>
                </AnchoredPopover>
              </div>
            </div>
          </div>
          {downloadedModels.map((model: ModelInfo) => (
            <ModelCard
              key={model.id}
              model={model}
              status={getModelStatus(model.id)}
              onSelect={handleModelSelect}
              onDownload={handleModelDownload}
              onDelete={handleModelDelete}
              onCancel={handleModelCancel}
              downloadProgress={getDownloadProgress(model.id)}
              downloadSpeed={getDownloadSpeed(model.id)}
              showRecommended={false}
            />
          ))}
        </div>

        {/* Available Models Section */}
        {availableModels.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-text/60">
              {t("settings.models.availableModels")}
            </h2>
            {availableModels.map((model: ModelInfo) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getModelStatus(model.id)}
                onSelect={handleModelSelect}
                onDownload={handleModelDownload}
                onDelete={handleModelDelete}
                onCancel={handleModelCancel}
                downloadProgress={getDownloadProgress(model.id)}
                downloadSpeed={getDownloadSpeed(model.id)}
                showRecommended={true}
              />
            ))}
          </div>
        )}
        {filteredModels.length === 0 && (
          <div className="text-center py-8 text-text/50">
            {t("settings.models.noModelsMatch")}
          </div>
        )}
      </div>
    </div>
  );
};
