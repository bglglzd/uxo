import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { commands, type UpdateInfo } from "@/bindings";

/** Payload of the backend's `update-download-progress` event. */
export interface UpdateDownloadProgress {
  downloaded: number;
  total: number | null;
}

export type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

interface UpdateStore {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  progress: UpdateDownloadProgress | null;
  error: string | null;
  lastCheckedAt: number | null;
  dialogOpen: boolean;

  check: (options?: { silent?: boolean }) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  setDialogOpen: (open: boolean) => void;
}

const DOWNLOAD_PROGRESS_EVENT = "update-download-progress";

let progressListener: Promise<() => void> | null = null;

const ensureProgressListener = (
  set: (partial: Partial<UpdateStore>) => void,
) => {
  progressListener ??= listen<UpdateDownloadProgress>(
    DOWNLOAD_PROGRESS_EVENT,
    (event) => set({ progress: event.payload }),
  );
  return progressListener;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  phase: "idle",
  info: null,
  progress: null,
  error: null,
  lastCheckedAt: null,
  dialogOpen: false,

  check: async ({ silent = false } = {}) => {
    const { phase } = get();
    // Never interrupt a download or a pending install with a re-check.
    if (
      phase === "checking" ||
      phase === "downloading" ||
      phase === "ready" ||
      phase === "installing"
    ) {
      return;
    }

    set({ phase: "checking", error: null });
    try {
      const result = await commands.checkForUpdate();
      if (result.status === "error") throw new Error(result.error);
      const info = result.data;
      set({
        info,
        phase: info ? "available" : "up-to-date",
        lastCheckedAt: Date.now(),
      });
    } catch (error) {
      // Background checks fail quietly (offline, rate limited); the user can
      // always retry from About.
      set({
        phase: silent ? "idle" : "error",
        error: silent ? null : message(error),
      });
    }
  },

  download: async () => {
    if (get().phase !== "available" && get().phase !== "error") return;
    set({ phase: "downloading", progress: null, error: null });
    try {
      await ensureProgressListener(set);
      const result = await commands.downloadUpdate();
      if (result.status === "error") throw new Error(result.error);
      set({ phase: "ready" });
    } catch (error) {
      set({ phase: "error", error: message(error) });
    }
  },

  install: async () => {
    if (get().phase !== "ready") return;
    set({ phase: "installing", error: null });
    try {
      const result = await commands.installUpdate();
      if (result.status === "error") throw new Error(result.error);
      // The app exits and the installer relaunches it.
    } catch (error) {
      set({ phase: "ready", error: message(error) });
    }
  },

  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
}));
