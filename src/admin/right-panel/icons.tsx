// Inline SVG icons used by RightPanel tabs and per-block panels. Extracted
// from RightPanel.tsx (audit M1, conservative slice). Keeping them here
// instead of inlining each occurrence makes the panel body easier to read
// and lets reviewers see the icon set in one place.

export function IconFields() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="10.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}

export function IconStyle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 1.5C7.5 1.5 11.5 4.5 11.5 7.5C11.5 9.71 9.71 11.5 7.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconAdvanced() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
      <path d="m22,13.25v-2.5l-2.318-.966c-.167-.581-.395-1.135-.682-1.654l.954-2.318-1.768-1.768-2.318.954c-.518-.287-1.073-.515-1.654-.682l-.966-2.318h-2.5l-.966,2.318c-.581.167-1.135.395-1.654.682l-2.318-.954-1.768,1.768.954,2.318c-.287.518-.515,1.073-.682,1.654l-2.318.966v2.5l2.318.966c.167.581.395,1.135.682,1.654l-.954,2.318,1.768,1.768,2.318-.954c.518.287,1.073.515,1.654.682l.966,2.318h2.5l.966-2.318c.581-.167,1.135-.395,1.654-.682l2.318.954,1.768-1.768-.954-2.318c.287-.518.515-1.073.682-1.654l2.318-.966Z" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
    </svg>
  );
}

export function IconStateNormal() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="6.5" r="3" fill="currentColor"/>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
    </svg>
  );
}

export function IconStateHover() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2.5L3 10L5.5 7.5L7 11L8.5 10.4L7 7H10.5L3 2.5Z" fill="currentColor" strokeLinejoin="round"/>
    </svg>
  );
}
