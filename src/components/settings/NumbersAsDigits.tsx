import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface NumbersAsDigitsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const NumbersAsDigits: React.FC<NumbersAsDigitsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    return (
      <ToggleSwitch
        checked={getSetting("numbers_as_digits") ?? true}
        onChange={(enabled) => updateSetting("numbers_as_digits", enabled)}
        isUpdating={isUpdating("numbers_as_digits")}
        label={t("settings.advanced.numbersAsDigits.title")}
        description={t("settings.advanced.numbersAsDigits.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);

NumbersAsDigits.displayName = "NumbersAsDigits";
