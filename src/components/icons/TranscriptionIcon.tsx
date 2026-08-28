import React from "react";

interface TranscriptionIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const TranscriptionIcon: React.FC<TranscriptionIconProps> = ({
  width = 24,
  height = 24,
  color = "currentColor",
  className = "",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.25 4.25h11.5A2.25 2.25 0 0 1 20 6.5v8.25A2.25 2.25 0 0 1 17.75 17H11.5L7 20v-3h-.75A2.25 2.25 0 0 1 4 14.75V6.5a2.25 2.25 0 0 1 2.25-2.25Z"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.25 10.25v1.5m2.5-3v4.5m5-3.75v3m2.5-1.75v1"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M12 8h1.5m-.75 0v5m-.75 0h1.5"
      stroke="var(--uxo-icon-accent, currentColor)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default TranscriptionIcon;
