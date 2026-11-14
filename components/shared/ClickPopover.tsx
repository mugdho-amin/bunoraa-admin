"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ClickPopoverProps = {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: React.ReactNode;
  placement?: "below-right" | "below-left" | "above-left";
  className?: string;
  panelClassName?: string;
  onOpenChange?: (open: boolean) => void;
  closeOnContentClick?: boolean;
};

/** A small click/tap popover for command menus and custom panels. */
export function ClickPopover({
  trigger,
  children,
  placement = "below-right",
  className = "",
  panelClassName = "",
  onOpenChange,
  closeOnContentClick = false,
}: ClickPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const changeOpen = useCallback((value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  }, [onOpenChange]);
  const toggle = useCallback(() => changeOpen(!open), [changeOpen, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) changeOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") changeOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [changeOpen, open]);

  return (
    <div ref={rootRef} className={`admin-click-popover ${className}`.trim()}>
      {trigger(open, toggle)}
      {open && (
        <div className={`admin-click-popover-panel is-${placement} ${panelClassName}`.trim()}>
          <div onClick={closeOnContentClick ? () => changeOpen(false) : undefined}>{children}</div>
        </div>
      )}
    </div>
  );
}
