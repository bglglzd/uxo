import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { ResetButton } from "../ui/ResetButton";
import { AnchoredPopover, focusAdjacentControl } from "../ui/AnchoredPopover";
import { useSettings } from "../../hooks/useSettings";
import {
  getLanguageLabel,
  recognitionLanguage,
  SELECTABLE_LANGUAGES,
  supportsLanguageCode,
} from "../../lib/constants/languages";

interface LanguageSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  supportedLanguages?: string[];
  // Whether the model can auto-detect language. Gates the "Auto" option:
  // must-pick models (no detection) omit it and force a concrete choice.
  supportsLanguageDetection?: boolean;
}

// Mirrors the matching logic of `effective_language` in
// src-tauri/src/managers/model.rs. The Rust function is authoritative for the
// *concrete* code the engine receives (e.g. "en-US"); this resolves the
// canonical *base* code ("en") so the highlighted picker item matches an entry
// in the LANGUAGES list. Matching is base-aware (`supportsLanguageCode` strips
// region/script subtags), so a model advertising full locales still resolves.
const effectiveLanguage = (
  intent: string,
  supported: string[],
  supportsDetection: boolean,
): string => {
  if (supported.length === 0) return intent;
  if (intent !== "auto" && supportsLanguageCode(supported, intent))
    return intent;
  if (supportsDetection) return "auto";
  if (supportsLanguageCode(supported, "en")) return "en";
  return recognitionLanguage(supported[0]);
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  supportedLanguages,
  supportsLanguageDetection = true,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, resetSetting, isUpdating } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const triggerId = `uxo-language-trigger-${id}`;
  const dialogId = `uxo-language-dialog-${id}`;
  const listboxId = `uxo-language-listbox-${id}`;

  // The persisted *intent* (auto | code). What's actually used/shown is the
  // effective value resolved against the current model's capabilities.
  const intent = getSetting("selected_language") || "auto";
  const selectedLanguage = effectiveLanguage(
    intent,
    supportedLanguages ?? [],
    supportsLanguageDetection,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const availableLanguages = useMemo(() => {
    if (!supportedLanguages || supportedLanguages.length === 0)
      return SELECTABLE_LANGUAGES;
    return SELECTABLE_LANGUAGES.filter((lang) =>
      lang.value === "auto"
        ? supportsLanguageDetection
        : supportsLanguageCode(supportedLanguages, lang.value),
    );
  }, [supportedLanguages, supportsLanguageDetection]);

  const filteredLanguages = useMemo(
    () =>
      availableLanguages.filter((language) =>
        language.label.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery, availableLanguages],
  );
  const selectedFilteredIndex = filteredLanguages.findIndex(
    (language) => language.value === selectedLanguage,
  );
  const effectiveActiveIndex = filteredLanguages[activeIndex]
    ? activeIndex
    : selectedFilteredIndex >= 0
      ? selectedFilteredIndex
      : filteredLanguages.length > 0
        ? 0
        : -1;

  useEffect(() => {
    if (!isOpen || effectiveActiveIndex < 0) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`${listboxId}-option-${effectiveActiveIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [effectiveActiveIndex, isOpen, listboxId]);

  const selectedLanguageName =
    getLanguageLabel(selectedLanguage) || t("settings.general.language.auto");

  const handleLanguageSelect = async (languageCode: string) => {
    setIsOpen(false);
    setSearchQuery("");
    triggerRef.current?.focus();
    await updateSetting("selected_language", languageCode);
  };

  const handleReset = async () => {
    await resetSetting("selected_language");
  };

  const openLanguageMenu = (preferLast = false) => {
    if (isUpdating("selected_language")) return;
    setSearchQuery("");
    const selectedIndex = availableLanguages.findIndex(
      (language) => language.value === selectedLanguage,
    );
    setActiveIndex(
      selectedIndex >= 0
        ? selectedIndex
        : preferLast
          ? Math.max(0, availableLanguages.length - 1)
          : 0,
    );
    setIsOpen(true);
  };

  const closeLanguageMenu = (restoreFocus = false) => {
    setIsOpen(false);
    setSearchQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  const handleToggle = () => {
    if (isOpen) closeLanguageMenu();
    else openLanguageMenu();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (filteredLanguages.length > 0) {
          setActiveIndex(
            (effectiveActiveIndex +
              (event.key === "ArrowDown" ? 1 : -1) +
              filteredLanguages.length) %
              filteredLanguages.length,
          );
        }
        break;
      case "Home":
      case "End":
        event.preventDefault();
        setActiveIndex(
          event.key === "Home" ? 0 : Math.max(0, filteredLanguages.length - 1),
        );
        break;
      case "Enter":
        if (effectiveActiveIndex >= 0) {
          event.preventDefault();
          void handleLanguageSelect(
            filteredLanguages[effectiveActiveIndex].value,
          );
        }
        break;
      case "Escape":
        event.preventDefault();
        closeLanguageMenu(true);
        break;
      case "Tab":
        event.preventDefault();
        closeLanguageMenu();
        focusAdjacentControl(triggerRef.current, event.shiftKey);
        break;
    }
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      openLanguageMenu(event.key === "ArrowUp" || event.key === "End");
      if (event.key === "Home") setActiveIndex(0);
      if (event.key === "End") {
        setActiveIndex(Math.max(0, availableLanguages.length - 1));
      }
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeLanguageMenu(true);
    } else if (event.key === "Tab") {
      closeLanguageMenu();
    }
  };

  return (
    <SettingContainer
      title={t("settings.general.language.title")}
      description={t("settings.general.language.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="flex items-center space-x-1">
        <div className="relative" ref={dropdownRef}>
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className={`px-2 py-1 text-sm font-semibold bg-mid-gray/10 border border-mid-gray/80 rounded min-w-[200px] text-start flex items-center justify-between transition-all duration-150 ${
              isUpdating("selected_language")
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-logo-primary/10 cursor-pointer hover:border-logo-primary"
            }`}
            onClick={handleToggle}
            onKeyDown={handleTriggerKeyDown}
            disabled={isUpdating("selected_language")}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-controls={dialogId}
          >
            <span className="truncate">{selectedLanguageName}</span>
            <svg
              className={`w-4 h-4 ms-2 transition-transform duration-200 ${
                isOpen ? "transform rotate-180" : ""
              }`}
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

          <AnchoredPopover
            anchorRef={triggerRef}
            popoverRef={menuRef}
            open={isOpen && !isUpdating("selected_language")}
            id={dialogId}
            role="dialog"
            ariaLabelledBy={triggerId}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-glass shadow-xl backdrop-blur-xl"
          >
            {/* Search input */}
            <div className="p-2 border-b border-mid-gray/80">
              <input
                ref={searchInputRef}
                type="text"
                role="combobox"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder={t("settings.general.language.searchPlaceholder")}
                aria-labelledby={triggerId}
                aria-expanded={true}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  effectiveActiveIndex >= 0
                    ? `${listboxId}-option-${effectiveActiveIndex}`
                    : undefined
                }
                className="w-full px-2 py-1 text-sm bg-mid-gray/10 border border-mid-gray/40 rounded focus:outline-none focus:ring-1 focus:ring-logo-primary focus:border-logo-primary"
              />
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={triggerId}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {filteredLanguages.length === 0 ? (
                <div className="px-2 py-2 text-sm text-mid-gray text-center">
                  {t("settings.general.language.noResults")}
                </div>
              ) : (
                filteredLanguages.map((language, index) => (
                  <button
                    key={language.value}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selectedLanguage === language.value}
                    tabIndex={-1}
                    className={`w-full px-2 py-1 text-sm text-start hover:bg-logo-primary/10 transition-colors duration-150 ${
                      effectiveActiveIndex === index
                        ? "bg-logo-primary/10 ring-1 ring-inset ring-logo-primary/35"
                        : ""
                    } ${
                      selectedLanguage === language.value
                        ? "bg-logo-primary/20 text-logo-primary font-semibold"
                        : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleLanguageSelect(language.value)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{language.label}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </AnchoredPopover>
        </div>
        <ResetButton
          onClick={handleReset}
          disabled={isUpdating("selected_language")}
        />
      </div>
      {isUpdating("selected_language") && (
        <div className="absolute inset-0 bg-mid-gray/10 rounded flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
