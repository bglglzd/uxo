import React, { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { Button } from "../ui/Button";
import { SettingContainer } from "../ui/SettingContainer";

interface WindowsInputCompatibilityStatus {
  supported: boolean;
  runningAsAdministrator: boolean;
  canRestartAsAdministrator: boolean;
}

interface WindowsElevatedInputProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const WindowsElevatedInput: React.FC<WindowsElevatedInputProps> = ({
  descriptionMode = "inline",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<WindowsInputCompatibilityStatus | null>(
    null,
  );
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (platform() !== "windows") return;

    let active = true;
    commands
      .getWindowsInputCompatibilityStatus()
      .then((result) => {
        if (result.status === "ok" && active) {
          setStatus(result.data);
        } else if (result.status === "error") {
          console.warn(
            "Failed to read Windows input compatibility status:",
            result.error,
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Failed to read Windows input compatibility status:",
          error,
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const restartAsAdministrator = async () => {
    setIsRestarting(true);
    try {
      const result = await commands.restartAsAdministrator();
      if (result.status === "error") {
        toast.error(t("errors.elevatedRestartFailed"));
        setIsRestarting(false);
      }
    } catch (error) {
      console.warn("Failed to restart UXO as administrator:", error);
      toast.error(t("errors.elevatedRestartFailed"));
      setIsRestarting(false);
    }
  };

  if (
    !status?.supported ||
    (!status.runningAsAdministrator && !status.canRestartAsAdministrator)
  ) {
    return null;
  }

  return (
    <SettingContainer
      title={t("settings.advanced.elevatedInput.title")}
      description={t("settings.advanced.elevatedInput.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      {status.runningAsAdministrator ? (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
          {t("settings.advanced.elevatedInput.active")}
        </span>
      ) : (
        <Button
          type="button"
          variant="warning"
          size="sm"
          disabled={isRestarting}
          onClick={restartAsAdministrator}
        >
          {isRestarting
            ? t("settings.advanced.elevatedInput.restarting")
            : t("settings.advanced.elevatedInput.restart")}
        </Button>
      )}
    </SettingContainer>
  );
};
