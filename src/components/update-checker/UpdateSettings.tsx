import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Button } from "../ui/Button";
import { useSettings } from "@/hooks/useSettings";
import { useUpdateStore } from "@/stores/updateStore";

interface UpdateSettingsProps {
  grouped?: boolean;
}

/** About-page rows: manual check plus the background-check toggle. */
export const UpdateSettings: React.FC<UpdateSettingsProps> = ({
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const { phase, info, error, check, setDialogOpen } = useUpdateStore();

  const status = (() => {
    switch (phase) {
      case "checking":
        return t("updates.checking");
      case "up-to-date":
        return t("updates.upToDate");
      case "error":
        return info ? null : t("updates.checkFailed", { error });
      default:
        return info
          ? t("updates.available", { version: info.latest_version })
          : null;
    }
  })();

  return (
    <>
      <SettingContainer
        title={t("updates.title")}
        description={t("updates.description")}
        descriptionMode="tooltip"
        grouped={grouped}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          {status && (
            <span
              role="status"
              aria-live="polite"
              className="text-xs text-mid-gray"
            >
              {status}
            </span>
          )}
          {info ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setDialogOpen(true)}
            >
              {t("updates.whatsNew")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              disabled={phase === "checking"}
              onClick={() => void check()}
            >
              {t("updates.checkNow")}
            </Button>
          )}
        </div>
      </SettingContainer>
      <ToggleSwitch
        checked={getSetting("update_checks_enabled") ?? true}
        onChange={(enabled) => updateSetting("update_checks_enabled", enabled)}
        isUpdating={isUpdating("update_checks_enabled")}
        label={t("updates.autoCheck.title")}
        description={t("updates.autoCheck.description")}
        descriptionMode="tooltip"
        grouped={grouped}
      />
    </>
  );
};
