import React from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  Cpu,
  FlaskConical,
  History,
  Info,
  SlidersHorizontal,
  WandSparkles,
} from "lucide-react";
import UxoLogo from "./icons/UxoLogo";
import { useSettings } from "../hooks/useSettings";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  DebugSettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  general: {
    labelKey: "sidebar.general",
    icon: AudioLines,
    component: GeneralSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: Cpu,
    component: ModelsSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: SlidersHorizontal,
    component: AdvancedSettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: WandSparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <aside className="uxo-sidebar flex h-full w-48 shrink-0 flex-col px-3">
      <div className="uxo-sidebar-brand flex h-24 items-center justify-center">
        <UxoLogo width={116} className="text-text" />
      </div>
      <nav
        aria-label={t("sidebar.navigation")}
        className="uxo-sidebar-nav flex w-full flex-1 flex-col gap-1.5 border-t border-mid-gray/15 pt-4"
      >
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              type="button"
              key={section.id}
              aria-current={isActive ? "page" : undefined}
              className={`uxo-nav-item group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-all duration-200 ${isActive ? "is-active" : ""}`}
              onClick={() => onSectionChange(section.id)}
            >
              <span className="uxo-nav-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <Icon
                  width={18}
                  height={18}
                  strokeWidth={1.8}
                  className="shrink-0"
                />
              </span>
              <span
                className="truncate text-sm font-medium"
                title={t(section.labelKey)}
              >
                {t(section.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="uxo-sidebar-rail mb-4 h-px w-full" aria-hidden="true" />
    </aside>
  );
};
