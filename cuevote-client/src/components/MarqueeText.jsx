// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import React, { useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

/**
 * MarqueeText — displays text that scrolls horizontally (billboard-style)
 * only when its content overflows the available container width.
 *
 * Uses the same `animate-billboard` keyframes + `mask-linear-fade` pattern
 * as the channel-name marquee in the lobby, so the visual behavior is
 * consistent: short pause at start, scroll through, short pause again, loop.
 *
 * When content fits, falls back to a plain truncated span (no animation).
 */
export function MarqueeText({ children, className = "", as = "span" }) {
  const Tag = as;
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measurer = measureRef.current;
    if (!container || !measurer) return undefined;

    const check = () => {
      // +1 px tolerance for sub-pixel rounding
      setOverflows(measurer.scrollWidth > container.clientWidth + 1);
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(container);
    observer.observe(measurer);
    return () => observer.disconnect();
  }, [children]);

  // Match the lobby's duration scaling so animation speed feels consistent.
  const text = typeof children === "string" ? children : String(children ?? "");
  const duration = Math.max(10, text.length * 0.4);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap relative ${overflows ? "mask-linear-fade" : ""} ${className}`}
    >
      {/* Hidden measurement element: always reflects the natural (un-duplicated) width
          so we can detect both overflow→fit and fit→overflow transitions on resize. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 whitespace-nowrap pointer-events-none"
      >
        {children}
      </span>

      {overflows ? (
        <Tag
          className="animate-billboard inline-block"
          style={{ animationDuration: `${duration}s` }}
        >
          {children}&nbsp;&nbsp;&nbsp;&nbsp;{children}&nbsp;&nbsp;&nbsp;&nbsp;
        </Tag>
      ) : (
        <Tag className="block truncate">{children}</Tag>
      )}
    </div>
  );
}

MarqueeText.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
};
