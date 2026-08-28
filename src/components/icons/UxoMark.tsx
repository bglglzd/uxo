import { useId } from "react";

interface UxoMarkProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
}

const UxoMark = ({ width, height, size, className }: UxoMarkProps) => {
  const resolvedWidth = size ?? width ?? 64;
  const resolvedHeight = size ?? height ?? width ?? 64;
  const idSeed = useId().replace(/:/g, "");
  const waveId = `${idSeed}-wave`;
  const caretId = `${idSeed}-caret`;

  return (
    <svg
      width={resolvedWidth}
      height={resolvedHeight}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={waveId} x1="12" y1="21" x2="51" y2="43">
          <stop stopColor="var(--color-brand-cyan-start, #73e0ea)" />
          <stop offset="1" stopColor="var(--color-brand-cyan-end, #1ca8c0)" />
        </linearGradient>
        <linearGradient id={caretId} x1="0" y1="18" x2="0" y2="46">
          <stop stopColor="var(--color-brand-amber-start, #f6ca69)" />
          <stop offset="1" stopColor="var(--color-brand-amber-end, #e99834)" />
        </linearGradient>
      </defs>
      <rect
        x="3.5"
        y="3.5"
        width="57"
        height="57"
        rx="14.5"
        fill="var(--color-brand-ink, #071827)"
        stroke="var(--color-brand-border, #24556a)"
        strokeWidth="1.75"
      />
      <g fill={`url(#${waveId})`}>
        <rect x="10" y="29" width="4" height="6" rx="2" />
        <rect x="17" y="25" width="5" height="14" rx="2.5" />
        <rect x="25" y="19" width="6" height="26" rx="3" />
        <rect x="41" y="23" width="6" height="18" rx="3" />
        <rect x="50" y="28" width="4" height="8" rx="2" />
      </g>
      <path
        d="M34 18.5h5m-2.5 0v27M34 45.5h5"
        stroke={`url(#${caretId})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default UxoMark;
