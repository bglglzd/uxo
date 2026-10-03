import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface BuiltinDictionaryProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const BuiltinDictionary: React.FC<BuiltinDictionaryProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    return (
      <ToggleSwitch
        checked={getSetting("builtin_dictionary_enabled") ?? true}
        onChange={(enabled) =>
          updateSetting("builtin_dictionary_enabled", enabled)
        }
        isUpdating={isUpdating("builtin_dictionary_enabled")}
        label={t("settings.advanced.builtinDictionary.title")}
        description={t("settings.advanced.builtinDictionary.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);

BuiltinDictionary.displayName = "BuiltinDictionary";
