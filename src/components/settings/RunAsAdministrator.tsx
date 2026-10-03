import React, { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { commands, type WindowsInputCompatibilityStatus } from "@/bindings";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface RunAsAdministratorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/**
 * Windows-only opt-in: start UXO elevated (through UAC) on every launch so
 * dictation reaches terminals and shells that run as administrator.
 */
export const RunAsAdministrator: React.FC<RunAsAdministratorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const [status, setStatus] = useState<WindowsInputCompatibilityStatus | null>(
    null,
  );
  const [isPortable, setIsPortable] = useState(false);

  useEffect(() => {
    if (platform() !== "windows") return;
    let active = true;
    void commands.getWindowsInputCompatibilityStatus().then((result) => {
      if (active && result.status === "ok") setStatus(result.data);
    });
    void commands.isPortable().then((portable) => {
      if (active) setIsPortable(portable);
    });
    return () => {
      active = false;
    };
  }, []);

  if (
    isPortable ||
    !status?.supported ||
    (!status.runningAsAdministrator && !status.canRestartAsAdministrator)
  ) {
    return null;
  }

  const handleChange = async (enabled: boolean) => {
    await updateSetting("run_as_administrator", enabled);
    if (enabled && !status.runningAsAdministrator) {
      // Apply right away instead of waiting for the next launch.
      const result = await commands.restartAsAdministrator();
      if (result.status === "error") {
        toast.error(t("errors.elevatedRestartFailed"));
      }
    }
  };

  return (
    <ToggleSwitch
      checked={getSetting("run_as_administrator") ?? false}
      onChange={(enabled) => void handleChange(enabled)}
      isUpdating={isUpdating("run_as_administrator")}
      label={t("settings.advanced.runAsAdministrator.title")}
      description={t("settings.advanced.runAsAdministrator.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    />
  );
};
