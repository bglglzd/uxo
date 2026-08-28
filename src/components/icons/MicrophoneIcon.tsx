import React from "react";

interface MicrophoneIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const MicrophoneIcon: React.FC<MicrophoneIconProps> = ({
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
    <rect
      x="8.25"
      y="3.25"
      width="7.5"
      height="12"
      rx="3.75"
      stroke={color}
      strokeWidth="1.75"
    />
    <path
      d="M5.75 11.5V12A6.25 6.25 0 0 0 12 18.25 6.25 6.25 0 0 0 18.25 12v-.5M12 18.25V21m-2.75 0h5.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.75 7h2.5M12 7v4.5m-1.25 0h2.5"
      stroke="var(--uxo-icon-accent, currentColor)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default MicrophoneIcon;
