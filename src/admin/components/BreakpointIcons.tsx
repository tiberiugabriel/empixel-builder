import React from "react";
import type { BreakpointId } from "../../types.js";

const BpIconDesktop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="2" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 14H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M8 11V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const BpIconLaptop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2.5" width="12" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M0.5 13.5H15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5.5 13.5L6 11H10L10.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

const BpIconTabletLandscape = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="13.5" cy="8" r="0.8" fill="currentColor" />
  </svg>
);

const BpIconTabletPortrait = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="13" r="0.8" fill="currentColor" />
  </svg>
);

const BpIconMobileLandscape = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="13.5" cy="8.5" r="0.8" fill="currentColor" />
  </svg>
);

const BpIconMobilePortrait = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="1" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="13" r="0.8" fill="currentColor" />
  </svg>
);

export const BP_ICONS: Record<string, React.ReactNode> = {
  desktop:            <BpIconDesktop />,
  laptop:             <BpIconLaptop />,
  "tablet-landscape": <BpIconTabletLandscape />,
  "tablet-portrait":  <BpIconTabletPortrait />,
  "mobile-landscape": <BpIconMobileLandscape />,
  "mobile-portrait":  <BpIconMobilePortrait />,
};

export function getBpIcon(id: BreakpointId | string): React.ReactNode {
  return BP_ICONS[id] ?? null;
}
