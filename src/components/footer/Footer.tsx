import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

import ModelSelector from "../model-selector";

const Footer: React.FC = () => {
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.0");
      }
    };

    fetchVersion();
  }, []);

  return (
    <footer className="uxo-footer relative z-20 w-full border-t border-mid-gray/15">
      <div className="flex h-11 items-center justify-between px-4 text-xs text-text/55">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="uxo-status-dot h-2 w-2 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <ModelSelector />
        </div>

        <div className="uxo-version-pill flex items-center gap-1 rounded-full px-2.5 py-1 font-medium tabular-nums">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span>v{version}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
