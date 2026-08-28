import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface PathDisplayProps {
  path: string;
  onOpen: () => void;
  disabled?: boolean;
}

export const PathDisplay: React.FC<PathDisplayProps> = ({
  path,
  onOpen,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 cursor-text select-text break-all rounded-xl border border-border bg-surface-raised/75 px-3 py-2 text-xs font-mono text-text shadow-sm">
        {path}
      </div>
      <Button
        onClick={onOpen}
        variant="secondary"
        size="sm"
        disabled={disabled}
        className="px-3 py-2"
      >
        {t("common.open")}
      </Button>
    </div>
  );
};
