import React from "react";

interface CancelIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const CancelIcon: React.FC<CancelIconProps> = ({
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
    <circle
      cx="12"
      cy="12"
      r="8.75"
      stroke={color}
      strokeWidth="1.75"
      opacity="0.56"
    />
    <path
      d="m8.75 8.75 6.5 6.5m0-6.5-6.5 6.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export default CancelIcon;
