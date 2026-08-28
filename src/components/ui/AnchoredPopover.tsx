import React, { useCallback, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type PopoverSide = "top" | "bottom";
type PopoverAlign = "start" | "end";

interface PopoverPosition {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
}

interface AnchoredPopoverProps {
  anchorRef: React.RefObject<HTMLElement>;
  ariaLabelledBy?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  align?: PopoverAlign;
  maxHeight?: number;
  open: boolean;
  popoverRef?: React.RefObject<HTMLDivElement>;
  preferredSide?: PopoverSide;
  role?: React.AriaRole;
  width?: number | "anchor";
}

const VIEWPORT_PADDING = 12;
const GAP = 8;
const DEFAULT_MAX_HEIGHT = 240;
const MIN_USEFUL_HEIGHT = 96;
const POPOVER_Z_INDEX = 10_000;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Move out of a portalled picker according to the trigger's DOM position. */
export const focusAdjacentControl = (
  trigger: HTMLElement | null,
  backwards: boolean,
) => {
  if (!trigger) return;

  window.requestAnimationFrame(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        !element.closest('[data-uxo-popover="true"]') &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0,
    );
    const triggerIndex = controls.indexOf(trigger);
    const target = controls[triggerIndex + (backwards ? -1 : 1)];
    (target ?? trigger).focus();
  });
};

/**
 * Renders a menu at the document root so card backdrop filters, z-indexes and
 * scroll containers cannot paint over or clip it.
 */
export const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({
  anchorRef,
  ariaLabelledBy,
  children,
  className = "",
  id,
  align = "start",
  maxHeight = DEFAULT_MAX_HEIGHT,
  open,
  popoverRef,
  preferredSide = "bottom",
  role,
  width: requestedWidth = "anchor",
}) => {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const availableBelow = Math.max(
      0,
      window.innerHeight - rect.bottom - GAP - VIEWPORT_PADDING,
    );
    const availableAbove = Math.max(0, rect.top - GAP - VIEWPORT_PADDING);
    const preferredSpace =
      preferredSide === "bottom" ? availableBelow : availableAbove;
    const alternateSpace =
      preferredSide === "bottom" ? availableAbove : availableBelow;
    const side: PopoverSide =
      preferredSpace >= Math.min(maxHeight, MIN_USEFUL_HEIGHT) ||
      preferredSpace >= alternateSpace
        ? preferredSide
        : preferredSide === "bottom"
          ? "top"
          : "bottom";
    const availableHeight = side === "bottom" ? availableBelow : availableAbove;
    const width = Math.min(
      requestedWidth === "anchor" ? rect.width : requestedWidth,
      window.innerWidth - VIEWPORT_PADDING * 2,
    );
    const isRtl = window.getComputedStyle(anchor).direction === "rtl";
    const alignToRightEdge =
      (align === "start" && isRtl) || (align === "end" && !isRtl);
    const desiredLeft = alignToRightEdge ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(desiredLeft, VIEWPORT_PADDING),
      window.innerWidth - width - VIEWPORT_PADDING,
    );

    setPosition({
      left,
      width,
      maxHeight: Math.min(maxHeight, availableHeight),
      ...(side === "bottom"
        ? { top: rect.bottom + GAP }
        : { bottom: window.innerHeight - rect.top + GAP }),
    });
  }, [align, anchorRef, maxHeight, preferredSide, requestedWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      id={id}
      role={role}
      aria-labelledby={ariaLabelledBy}
      data-uxo-popover="true"
      className={className}
      style={{
        position: "fixed",
        top: position?.top,
        bottom: position?.bottom,
        left: position?.left ?? -9999,
        width: position?.width,
        maxHeight: position?.maxHeight,
        zIndex: POPOVER_Z_INDEX,
        opacity: position ? 1 : 0,
      }}
    >
      {children}
    </div>,
    document.body,
  );
};
