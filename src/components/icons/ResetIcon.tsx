import React from "react";

interface ResetIconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

const ResetIcon: React.FC<ResetIconProps> = ({
  width = 20,
  height = 20,
  color = "currentColor",
  className = "",
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M16 7.25A6.5 6.5 0 1 0 16.08 12"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M12.5 7.25H16v-3.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ResetIcon;
