// Ported structure from 21st.dev community component:
//   "Sneaky Button" (Button06) by nextjsshop
//   https://21st.dev/@nextjsshop/components/sneaky-button
// License as listed on 21st.dev: unknown — attribution kept here. Review before commercial use.
// What changed: original ships only the arrow keyframe; the button06_* class
// definitions were not in the payload, so the hairline styling below implements
// design.md §2/§5 directly (hairline outline, sliding arrow). SVGs + keyframe kept verbatim.
import React from 'react';

export default function HairlineButton({ children, onClick, variant = "primary", small = false, type = "button", disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`hairline-btn ${variant === "secondary" ? "hairline-btn-secondary" : ""} ${small ? "hairline-btn-small" : ""}`}
    >
      <span className="hairline-btn-bg"></span>
      <span className="hairline-btn-inner">
        <span className="hairline-btn-text">{children}</span>
      </span>
      <span className="hairline-btn-icon">
        <span className="hairline-btn-icon-start">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 8 16" className="hairline-btn-icon-svg">
            <path fill="currentColor" d="M1.113 9.327a2.065 2.065 0 0 1 0-2.654L6.4.37C6.596.135 6.886 0 7.191 0h.55v16h-.55c-.305 0-.595-.135-.79-.369L1.112 9.327Z" />
          </svg>
        </span>
        <span className="hairline-btn-icon-mid"></span>
        <span className="hairline-btn-icon-end">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 16" className="hairline-btn-icon-svg">
            <path fill="currentColor" fillRule="evenodd" d="M5.288 1.696A1.032 1.032 0 0 0 4.497 0H1.032C.462 0 0 .462 0 1.032v13.936C0 15.538.462 16 1.032 16h3.465c.876 0 1.354-1.024.79-1.696L1.114 9.327a2.065 2.065 0 0 1 0-2.654l4.175-4.977Z" clipRule="evenodd" />
            <path fill="currentColor" d="M0 0h1.548v1.548H0zM0 14.452h1.548V16H0z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
