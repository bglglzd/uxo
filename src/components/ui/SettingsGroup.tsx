import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="w-full space-y-2.5">
      {title && (
        <div className="px-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text/45">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-mid-gray">{description}</p>
          )}
        </div>
      )}
      <div className="uxo-glass overflow-visible rounded-2xl">
        <div className="divide-y divide-border/60">{children}</div>
      </div>
    </section>
  );
};
