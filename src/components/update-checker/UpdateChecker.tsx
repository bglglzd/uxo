import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useUpdateStore } from "@/stores/updateStore";
import { UpdateDialog } from "./UpdateDialog";

const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Footer entry point for updates: runs quiet background checks (when enabled),
 * shows a pill when a newer version exists, and hosts the update dialog.
 */
export const UpdateChecker: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const checksEnabled = getSetting("update_checks_enabled") ?? true;
  const { phase, info, check, setDialogOpen } = useUpdateStore();

  useEffect(() => {
    if (!checksEnabled) return;
    const first = window.setTimeout(
      () => void check({ silent: true }),
      FIRST_CHECK_DELAY_MS,
    );
    const interval = window.setInterval(
      () => void check({ silent: true }),
      CHECK_INTERVAL_MS,
    );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [checksEnabled, check]);

  // Announce each newly found version once per session.
  const latest = info?.latest_version;
  useEffect(() => {
    if (!latest) return;
    toast(t("updates.toast", { version: latest }), {
      id: `update-${latest}`,
      action: {
        label: t("updates.whatsNew"),
        onClick: () => setDialogOpen(true),
      },
    });
  }, [latest, setDialogOpen, t]);

  const hasUpdate =
    info !== null &&
    (phase === "available" ||
      phase === "downloading" ||
      phase === "ready" ||
      phase === "installing" ||
      phase === "error");

  return (
    <>
      {hasUpdate && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-logo-primary/30 bg-logo-primary/10 px-2.5 py-1 text-xs font-medium text-logo-primary transition-colors hover:bg-logo-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-logo-primary/60"
        >
          <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {phase === "ready"
            ? t("updates.readyPill")
            : t("updates.pill", { version: info.latest_version })}
        </button>
      )}
      <UpdateDialog />
    </>
  );
};
