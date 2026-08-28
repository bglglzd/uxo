import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnchoredPopover } from "./AnchoredPopover";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefresh?: () => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  placeholder = "Select an option...",
  disabled = false,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const triggerId = `uxo-dropdown-trigger-${id}`;
  const listboxId = `uxo-dropdown-listbox-${id}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );
  const enabledIndexes = options.reduce<number[]>((indexes, option, index) => {
    if (!option.disabled) indexes.push(index);
    return indexes;
  }, []);
  const selectedIndex = options.findIndex(
    (option) => option.value === selectedValue && !option.disabled,
  );
  const effectiveActiveIndex = enabledIndexes.includes(activeIndex)
    ? activeIndex
    : selectedIndex >= 0
      ? selectedIndex
      : (enabledIndexes[0] ?? -1);

  useEffect(() => {
    if (!isOpen || effectiveActiveIndex < 0) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`${listboxId}-option-${effectiveActiveIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [effectiveActiveIndex, isOpen, listboxId]);

  const openMenu = (preferLast = false) => {
    if (disabled) return;
    onRefresh?.();
    setActiveIndex(
      selectedIndex >= 0
        ? selectedIndex
        : preferLast
          ? (enabledIndexes[enabledIndexes.length - 1] ?? -1)
          : (enabledIndexes[0] ?? -1),
    );
    setIsOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(effectiveActiveIndex);
    const nextPosition =
      currentPosition < 0
        ? direction === 1
          ? 0
          : enabledIndexes.length - 1
        : (currentPosition + direction + enabledIndexes.length) %
          enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const handleSelect = (value: string) => {
    onSelect(value);
    closeMenu(true);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          openMenu(event.key === "ArrowUp");
        } else {
          moveActive(event.key === "ArrowDown" ? 1 : -1);
        }
        break;
      case "Home":
      case "End":
        event.preventDefault();
        if (!isOpen) openMenu(event.key === "End");
        setActiveIndex(
          event.key === "Home"
            ? (enabledIndexes[0] ?? -1)
            : (enabledIndexes[enabledIndexes.length - 1] ?? -1),
        );
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen && effectiveActiveIndex >= 0) {
          handleSelect(options[effectiveActiveIndex].value);
        } else {
          openMenu();
        }
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          closeMenu(true);
        }
        break;
      case "Tab":
        closeMenu();
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        className={`grid min-w-[200px] w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-border bg-surface-glass px-3 py-2 text-start text-sm font-medium shadow-sm backdrop-blur-sm transition-all duration-200 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:border-logo-primary/55 hover:bg-surface-raised focus-visible:outline-none"
        }`}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && effectiveActiveIndex >= 0
            ? `${listboxId}-option-${effectiveActiveIndex}`
            : undefined
        }
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <AnchoredPopover
        anchorRef={triggerRef}
        popoverRef={menuRef}
        open={isOpen && !disabled}
        id={listboxId}
        role="listbox"
        ariaLabelledBy={triggerId}
        className="overflow-y-auto rounded-xl border border-border bg-surface-glass p-1 shadow-xl backdrop-blur-xl"
      >
        {options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-mid-gray">
            {t("common.noOptionsFound")}
          </div>
        ) : (
          options.map((option, index) => (
            <button
              key={option.value}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selectedValue === option.value}
              tabIndex={-1}
              className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors duration-150 ${
                effectiveActiveIndex === index
                  ? "bg-logo-primary/10 outline-none ring-1 ring-inset ring-logo-primary/35"
                  : ""
              } ${
                selectedValue === option.value
                  ? "bg-logo-primary/15 font-medium text-logo-primary"
                  : "hover:bg-logo-primary/10"
              } ${option.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              onMouseEnter={() => {
                if (!option.disabled) setActiveIndex(index);
              }}
              onClick={() => handleSelect(option.value)}
              disabled={option.disabled}
            >
              <span className="whitespace-normal break-words">
                {option.label}
              </span>
            </button>
          ))
        )}
      </AnchoredPopover>
    </div>
  );
};
