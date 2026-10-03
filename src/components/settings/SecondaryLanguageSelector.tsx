import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import {
  getLanguageLabel,
  getUniqueCapabilityLanguages,
  recognitionLanguage,
} from "../../lib/constants/languages";

interface SecondaryLanguageSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  supportedLanguages: string[];
}

const NONE = "none";

/**
 * Second language that is often mixed into dictation in the main language
 * (e.g. English terms in Russian speech). Only meaningful with a concrete
 * main language; auto-detect has nothing to pair it with.
 */
export const SecondaryLanguageSelector: React.FC<
  SecondaryLanguageSelectorProps
> = ({ descriptionMode = "tooltip", grouped = false, supportedLanguages }) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const primary = recognitionLanguage(
    getSetting("selected_language") ?? "auto",
  );
  const secondary = getSetting("secondary_language") ?? null;

  if (primary === "auto") return null;

  const options = [
    { value: NONE, label: t("settings.general.secondaryLanguage.none") },
    ...getUniqueCapabilityLanguages(supportedLanguages)
      .filter((code) => code !== primary)
      .map((code) => ({ value: code, label: getLanguageLabel(code) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return (
    <SettingContainer
      title={t("settings.general.secondaryLanguage.title")}
      description={t("settings.general.secondaryLanguage.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <Dropdown
        options={options}
        selectedValue={secondary ?? NONE}
        disabled={isUpdating("secondary_language")}
        onSelect={(value) =>
          updateSetting("secondary_language", value === NONE ? null : value)
        }
      />
    </SettingContainer>
  );
};
