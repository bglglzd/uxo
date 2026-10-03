import React from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, RotateCw } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { useUpdateStore } from "@/stores/updateStore";
import { formatBytes } from "./formatBytes";

const openExternal = (href?: string) => {
  if (href?.startsWith("https://")) {
    void openUrl(href);
  }
};

const ReleaseBody: React.FC<{ body: string }> = ({ body }) => (
  <div className="uxo-release-notes text-sm leading-relaxed text-text/85">
    <Markdown
      components={{
        // Release notes are remote content: open links in the browser instead
        // of navigating the app's webview, and never render raw HTML/images.
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              openExternal(href);
            }}
            className="text-logo-primary underline underline-offset-2"
          >
            {children}
          </a>
        ),
        img: () => null,
      }}
      skipHtml
    >
      {body}
    </Markdown>
  </div>
);

export const UpdateDialog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    phase,
    info,
    progress,
    error,
    dialogOpen,
    setDialogOpen,
    download,
    install,
  } = useUpdateStore();

  if (!info) return null;

  const busy = phase === "downloading" || phase === "installing";
  const percentage =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString(i18n.language, { dateStyle: "medium" });
  };

  const blockerText = info.install_blocker
    ? t(`updates.blocker.${info.install_blocker}`)
    : null;

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="md"
        onClick={() => openExternal(info.release_url)}
        className="inline-flex items-center gap-1.5"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        {t("updates.openReleasePage")}
      </Button>
      {!info.install_blocker &&
        (phase === "ready" || phase === "installing" ? (
          <Button
            variant="primary"
            size="md"
            disabled={phase === "installing"}
            onClick={() => void install()}
            className="inline-flex items-center gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            {phase === "installing"
              ? t("updates.installing")
              : t("updates.installAndRestart")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            disabled={phase === "downloading"}
            onClick={() => void download()}
            className="inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {phase === "downloading"
              ? t("updates.downloading")
              : info.download_size
                ? t("updates.downloadWithSize", {
                    size: formatBytes(info.download_size),
                  })
                : t("updates.download")}
          </Button>
        ))}
    </div>
  );

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => !busy && setDialogOpen(open)}
      dismissible={!busy}
      title={t("updates.dialogTitle", { version: info.latest_version })}
      description={t("updates.dialogDescription", {
        current: info.current_version,
        count: info.releases.length,
      })}
      closeLabel={t("common.close")}
      footer={footer}
      className="max-w-xl"
    >
      <div className="space-y-4">
        {phase === "downloading" && (
          <div role="status" aria-live="polite" className="space-y-1.5">
            <progress
              className="h-1.5 w-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-mid-gray/20 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-logo-primary"
              value={percentage ?? undefined}
              max={100}
            />
            <p className="text-xs tabular-nums text-mid-gray">
              {percentage !== null && progress?.total
                ? t("updates.progress", {
                    percent: percentage,
                    downloaded: formatBytes(progress.downloaded),
                    total: formatBytes(progress.total),
                  })
                : t("updates.downloading")}
            </p>
          </div>
        )}
        {phase === "ready" && (
          <p
            role="status"
            className="rounded-xl border border-logo-primary/25 bg-logo-primary/10 px-3 py-2 text-sm text-text"
          >
            {t("updates.verified")}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-error/35 bg-error/10 px-3 py-2 text-sm text-error"
          >
            {t("updates.failed", { error })}
          </p>
        )}
        {blockerText && (
          <p className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-text">
            {blockerText}
          </p>
        )}

        <ol className="space-y-4">
          {info.releases.map((release) => (
            <li
              key={release.version}
              className="rounded-xl border border-mid-gray/20 bg-mid-gray/5 p-3"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-text">
                  {release.name}
                </h3>
                <span className="text-xs text-mid-gray">
                  {[
                    release.prerelease ? t("updates.preview") : null,
                    formatDate(release.published_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {release.body.trim() ? (
                <ReleaseBody body={release.body} />
              ) : (
                <p className="text-sm text-mid-gray">{t("updates.noNotes")}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  );
};
