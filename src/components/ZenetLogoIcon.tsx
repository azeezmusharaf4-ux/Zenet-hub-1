import React from 'react';

interface ZenetLogoIconProps {
  className?: string;
  size?: number | string;
}

/**
 * ZenetLogoIcon: Premium, modern capital letter "Z" brand identity mark.
 * - Bold, geometric, and instantly recognizable capital letter Z.
 * - Precision-engineered with brand purple, indigo, and royal violet gradients.
 * - Multi-facet architectural depth with subtle dynamic lighting sheen.
 * - Perfectly balanced for high-DPI screens on mobile and desktop.
 */
export const ZenetLogoIcon: React.FC<ZenetLogoIconProps> = ({
  className = "w-6 h-6",
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Zenet Hub Z Logo"
    >
      <defs>
        {/* Core Vibrant Brand Gradient */}
        <linearGradient id="zenetZBrandGradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="45%" stopColor="#5C5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Upper Facet Sheen */}
        <linearGradient id="zenetZSheenGradient" x1="4" y1="4" x2="19" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C7D2FE" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#5C5CF6" />
        </linearGradient>

        {/* Lower Grounding Shadow Facet */}
        <linearGradient id="zenetZDepthGradient" x1="8" y1="16" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>

        {/* Diagonal Core Energy Stream */}
        <linearGradient id="zenetZCoreStream" x1="14" y1="7" x2="10" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Base Bold "Z" Monogram */}
      <path
        d="M 5 4.5 C 4.45 4.5 4 4.95 4 5.5 V 6.3 C 4 6.85 4.45 7.3 5 7.3 H 14.1 L 4.65 17.7 C 4.2 18.2 4.55 19.5 5.5 19.5 H 19 C 19.55 19.5 20 19.05 20 18.5 V 17.7 C 20 17.15 19.55 16.7 19 16.7 H 9.9 L 19.35 6.3 C 19.8 5.8 19.45 4.5 18.5 4.5 H 5 Z"
        fill="url(#zenetZBrandGradient)"
      />

      {/* Dynamic Forward Energy Core Facet */}
      <path
        d="M 14.1 7.3 L 18.6 7.3 L 9.9 16.7 L 5.4 16.7 Z"
        fill="url(#zenetZCoreStream)"
      />

      {/* Upper Shelf Accent */}
      <path
        d="M 5 4.5 H 18.5 C 19.25 4.5 19.65 5.3 19.35 5.85 L 18.0 7.3 H 5 C 4.45 7.3 4 6.85 4 6.3 V 5.5 C 4 4.95 4.45 4.5 5 4.5 Z"
        fill="url(#zenetZSheenGradient)"
        opacity="0.8"
      />

      {/* Lower Base Grounding Accent */}
      <path
        d="M 9.9 16.7 H 19 C 19.55 16.7 20 17.15 20 17.7 V 18.5 C 20 19.05 19.55 19.5 19 19.5 H 7.0 L 9.9 16.7 Z"
        fill="url(#zenetZDepthGradient)"
        opacity="0.7"
      />
    </svg>
  );
};
