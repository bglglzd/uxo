import { useId } from "react";

interface UxoLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const UxoLogo = ({ width = 200, height, className }: UxoLogoProps) => {
  const idSeed = useId().replace(/:/g, "");
  const titleId = `${idSeed}-title`;
  const waveId = `${idSeed}-wave`;
  const caretId = `${idSeed}-caret`;

  return (
    <svg
      width={width}
      height={height ?? Math.round(width * 0.29)}
      viewBox="0 0 330 96"
      fill="none"
      className={className}
      aria-labelledby={titleId}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>UXO</title>
      <defs>
        <linearGradient id={waveId} x1="18" y1="32" x2="80" y2="64">
          <stop stopColor="var(--color-brand-cyan-start, #73e0ea)" />
          <stop offset="1" stopColor="var(--color-brand-cyan-end, #1ca8c0)" />
        </linearGradient>
        <linearGradient id={caretId} x1="0" y1="26" x2="0" y2="72">
          <stop stopColor="var(--color-brand-amber-start, #f6ca69)" />
          <stop offset="1" stopColor="var(--color-brand-amber-end, #e99834)" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="88"
        height="88"
        rx="22"
        fill="var(--color-brand-ink, #071827)"
        stroke="var(--color-brand-border, #24556a)"
        strokeWidth="2.5"
      />
      <g fill={`url(#${waveId})`}>
        <rect x="15" y="44" width="6" height="10" rx="3" />
        <rect x="26" y="36" width="8" height="26" rx="4" />
        <rect x="39" y="27" width="9" height="44" rx="4.5" />
        <rect x="64" y="33" width="9" height="32" rx="4.5" />
        <rect x="78" y="42" width="6" height="14" rx="3" />
      </g>
      <path
        d="M52 26h7m-3.5 0v46M52 72h7"
        stroke={`url(#${caretId})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <text
        x="112"
        y="67"
        fill="currentColor"
        fontFamily='Inter, "Segoe UI Variable Display", "Segoe UI", sans-serif'
        fontSize="57"
        fontWeight="750"
        letterSpacing="5"
      >
        UXO
      </text>
    </svg>
  );
};

export default UxoLogo;
