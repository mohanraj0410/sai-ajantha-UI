import React from "react";

interface IconProps {
  className?: string;
}

/**
 * Sai Ajantha Brand Icon Family (Brand Guidelines p. 33 & 35)
 * Uses Deep Navy (#153C66) + Deep Teal (#12878F) + Slate Grey (#7B8896)
 */
export function TrustIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 4L7 9.5v9.8c0 8.3 5.5 15.8 13 18.2 7.5-2.4 13-9.9 13-18.2V9.5L20 4Z"
        fill="#153C66"
      />
      <path
        d="M14.5 19.5l3.8 3.8 7.5-7.6"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="29" r="7" fill="#12878F" stroke="#FFFFFF" strokeWidth="1.5" />
      <path
        d="M27.2 29.2l2 2 3.8-4"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CustomizedSolutionsIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="8" width="22" height="24" rx="2" stroke="#153C66" strokeWidth="2.2" fill="#FFFFFF" />
      <path d="M11 14h12v12H11V14Z" stroke="#7B8896" strokeWidth="1.6" />
      <path d="M17 14v5h6" stroke="#153C66" strokeWidth="1.6" />
      <path
        d="M24 28l9.5-14.5 2.8 1.8L26.8 29.8 23.2 31l.8-3Z"
        fill="#12878F"
      />
    </svg>
  );
}

export function CommercialInteriorsIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M7 33V12l13-5v26H7Z" stroke="#153C66" strokeWidth="2.2" fill="#FFFFFF" />
      <path d="M20 12l13 4v17H20V12Z" fill="#7B8896" fillOpacity="0.25" stroke="#153C66" strokeWidth="2" />
      <path d="M10 16h7M10 23h7M13.5 16v7" stroke="#12878F" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="24.5" y="23" width="4" height="10" fill="#153C66" />
    </svg>
  );
}

export function QualityMaterialsIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 6L6 13l14 7 14-7-14-7Z" fill="#153C66" />
      <path d="M6 20l14 7 14-7" stroke="#12878F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 27l14 7 14-7" stroke="#153C66" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CreativeDesignIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 10a8 8 0 0 0-5 14.2V28h10v-3.8A8 8 0 0 0 20 10Z"
        stroke="#153C66"
        strokeWidth="2.2"
        fill="#FFFFFF"
      />
      <path d="M16.5 31.5h7M18 34.5h4" stroke="#153C66" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 15v8M16.5 18.5L20 15l3.5 3.5" stroke="#12878F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4v3M9 9l2 2M31 9l-2 2M5 19h3M32 19h3" stroke="#12878F" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SuccessfulProjectsIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="13" width="11" height="20" fill="#153C66" />
      <rect x="20" y="8" width="9" height="25" fill="#7B8896" fillOpacity="0.45" stroke="#153C66" strokeWidth="1.6" />
      <path d="M10 18h2M14 18h1M10 22h2M14 22h1M10 26h2M14 26h1" stroke="#FFFFFF" strokeWidth="1.6" />
      <path
        d="M8 31c8-1 17-5 24-13m0 0h-5m5 0v5"
        stroke="#12878F"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HappyClientsIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="11" r="3.5" fill="#12878F" />
      <circle cx="10" cy="14" r="3" fill="#153C66" />
      <circle cx="30" cy="14" r="3" fill="#153C66" />
      <path d="M14.5 18.5c1.5 2 3.5 3 5.5 3s4-1 5.5-3v13.5h-11V18.5Z" fill="#12878F" />
      <path d="M6 19.5c1.5 1.8 3 2.5 5 2.5v10H6V19.5Z" fill="#153C66" />
      <path d="M34 19.5c-1.5 1.8-3 2.5-5 2.5v10h5V19.5Z" fill="#153C66" />
    </svg>
  );
}

export function ExpertTeamIcon({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M14 12a6 6 0 0 1 12 0H14Z" fill="#12878F" />
      <rect x="13" y="12" width="14" height="2.2" rx="1" fill="#153C66" />
      <circle cx="20" cy="18" r="3.2" fill="#153C66" />
      <path d="M14 32v-4.5c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5V32H14Z" fill="#153C66" />
      <circle cx="9.5" cy="20" r="2.6" fill="#7B8896" />
      <path d="M5 32v-3.5c0-1.8 1.8-3.2 4.5-3.2" stroke="#153C66" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="30.5" cy="20" r="2.6" fill="#7B8896" />
      <path d="M35 32v-3.5c0-1.8-1.8-3.2-4.5-3.2" stroke="#153C66" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function TrustMarkIconById({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "trust":
      return <TrustIcon className={className} />;
    case "solutions":
      return <CustomizedSolutionsIcon className={className} />;
    case "commercial":
    case "residential":
      return <CommercialInteriorsIcon className={className} />;
    case "materials":
      return <QualityMaterialsIcon className={className} />;
    case "design":
      return <CreativeDesignIcon className={className} />;
    case "projects":
      return <SuccessfulProjectsIcon className={className} />;
    case "clients":
      return <HappyClientsIcon className={className} />;
    case "team":
      return <ExpertTeamIcon className={className} />;
    default:
      return <TrustIcon className={className} />;
  }
}

