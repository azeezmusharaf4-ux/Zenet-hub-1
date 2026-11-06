import React, { useEffect, useState, useMemo } from 'react';
import { X } from 'lucide-react';

export interface WhatsAppPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelUrl?: string;
  channelName?: string;
}

// Authentic WhatsApp Speech Bubble with Phone Handset
const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="10 12 155 152" 
    className={className} 
    aria-hidden="true"
  >
    <path 
      fill="#fff" 
      d="m12.966 161.238 10.439-38.114a73.42 73.42 0 0 1-9.821-36.772c.017-40.556 33.021-73.55 73.578-73.55 19.681.01 38.154 7.669 52.047 21.572s21.537 32.383 21.53 52.037c-.018 40.553-33.027 73.553-73.578 73.553h-.032c-12.313-.005-24.412-3.094-35.159-8.954z"
    />
    <path 
      fill="#25D366" 
      d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"
    />
    <path 
      fill="#fff" 
      fillRule="evenodd" 
      d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"
    />
  </svg>
);

// Monochrome White WhatsApp Icon for inside the Purple Action Button
const WhiteWhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className} 
    aria-hidden="true"
  >
    <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.49 0-2.95-.4-4.22-1.16l-.3-.18-3.13.82.84-3.05-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.85 5.8 2.4 1.55 1.55 2.4 3.61 2.4 5.8 0 4.52-3.68 8.24-8.13 8.24zm4.49-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.57.12-.17.25-.66.81-.81.98-.15.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.87-.2-.49-.41-.42-.57-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.78 2.72 4.31 3.81.6.26 1.07.42 1.44.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z" 
    />
  </svg>
);

export const WhatsAppPromoModal: React.FC<WhatsAppPromoModalProps> = ({
  isOpen,
  onClose,
  channelUrl = 'https://whatsapp.com/channel/0029VbCaoET9RZAh5qW0xp3e',
  channelName = 'ZENET THA PLUG ⚡'
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Smooth 3D animation lifecycle (550-600ms)
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      // Trigger enter animation on next tick for smooth transition
      const frame = requestAnimationFrame(() => {
        setIsAnimatingIn(true);
      });
      return () => cancelAnimationFrame(frame);
    } else if (shouldRender && !isClosing) {
      handleClose();
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setIsAnimatingIn(false);
    // Wait for the exit animation duration before unmounting
    setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      onClose();
    }, 550);
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    // Open the official WhatsApp Channel in a new tab
    try {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = channelUrl;
    }
    // Record interaction so the promo does not reappear immediately
    try {
      localStorage.setItem('zenet_whatsapp_promo_dismissed_at', String(Date.now()));
      localStorage.setItem('zenet_whatsapp_promo_joined_at', String(Date.now()));
    } catch {}
    handleClose();
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('zenet_whatsapp_promo_dismissed_at', String(Date.now()));
    } catch {}
    handleClose();
  };

  // Generate 16-lobed scalloped starburst rosette path matching the approved design
  const scallopPath = useMemo(() => {
    const scallops = 16;
    const rOuter = 44;
    const rInner = 36.5;
    const cx = 50;
    const cy = 50;
    let path = '';
    const step = (Math.PI * 2) / scallops;
    for (let i = 0; i < scallops; i++) {
      const angle1 = i * step - Math.PI / 2;
      const angleMid = angle1 + step / 2;
      const angle2 = (i + 1) * step - Math.PI / 2;

      const x1 = cx + rInner * Math.cos(angle1);
      const y1 = cy + rInner * Math.sin(angle1);
      const xPeak = cx + rOuter * Math.cos(angleMid);
      const yPeak = cy + rOuter * Math.sin(angleMid);
      const x2 = cx + rInner * Math.cos(angle2);
      const y2 = cy + rInner * Math.sin(angle2);

      if (i === 0) {
        path += `M ${x1.toFixed(2)},${y1.toFixed(2)} `;
      }
      path += `Q ${xPeak.toFixed(2)},${yPeak.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} `;
    }
    path += 'Z';
    return path;
  }, []);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-all duration-500 ease-out ${
        isAnimatingIn && !isClosing 
          ? 'bg-black/60 backdrop-blur-xs opacity-100 pointer-events-auto' 
          : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="zenet-whatsapp-promo-title"
    >
      {/* 3D Smoothly Animated Pop-up Card */}
      <div 
        className={`w-full max-w-[340px] sm:max-w-[360px] bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-purple-100/80 relative text-center flex flex-col items-center select-none transform-gpu transition-all duration-600 ${
          isAnimatingIn && !isClosing
            ? 'opacity-100 scale-100 translate-y-0 rotate-x-0'
            : 'opacity-0 scale-[0.88] translate-y-5 rotate-x-6'
        }`}
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 25px 60px -12px rgba(124, 58, 237, 0.25), 0 10px 25px -5px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-[#818CF8] hover:text-[#4338CA] hover:bg-purple-50 p-1.5 rounded-full transition-colors cursor-pointer"
          title="Close promotional pop-up"
          aria-label="Close"
        >
          <X className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Top Emblem: Soft Lilac Circle with Radiating Purple Ticks & WhatsApp Icon */}
        <div className="relative w-20 h-20 flex items-center justify-center mt-1 mb-3">
          {/* 6 Radiating Accent Ticks around the top emblem */}
          <svg 
            className="absolute -inset-3 w-[104px] h-[104px] pointer-events-none" 
            viewBox="0 0 100 100" 
            fill="none"
            aria-hidden="true"
          >
            {/* Top-left tick */}
            <line x1="26" y1="26" x2="17" y2="19" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
            {/* Left-horizontal tick */}
            <line x1="20" y1="50" x2="10" y2="50" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
            {/* Bottom-left tick */}
            <line x1="26" y1="74" x2="17" y2="81" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Top-right tick */}
            <line x1="74" y1="26" x2="83" y2="19" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
            {/* Right-horizontal tick */}
            <line x1="80" y1="50" x2="90" y2="50" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
            {/* Bottom-right tick */}
            <line x1="74" y1="74" x2="83" y2="81" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
          </svg>

          {/* Soft Lilac Glow Base */}
          <div className="w-18 h-18 rounded-full bg-[#EDE9FE] shadow-inner flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            {/* Authentic Green WhatsApp Emblem */}
            <div className="w-13 h-13 rounded-full flex items-center justify-center drop-shadow-md">
              <WhatsAppGlyph className="w-12 h-12" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h2 
          id="zenet-whatsapp-promo-title"
          className="text-[#1E1B4B] font-black text-lg sm:text-xl tracking-tight leading-tight mt-1"
        >
          JOIN OUR WHATSAPP GROUP
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-[13px] font-bold text-[#475569] mt-1.5 leading-snug">
          Get exclusive offers and special discounts!
        </p>

        {/* 20% OFF Promotional Badge with Radiating Rays */}
        <div 
          className="relative my-3 sm:my-3.5 cursor-pointer group flex items-center justify-center"
          onClick={handleJoinClick}
          title={`Join ${channelName}`}
        >
          {/* Radiating Rays around badge */}
          <svg 
            className="absolute -inset-4 w-[136px] h-[136px] pointer-events-none" 
            viewBox="0 0 120 120" 
            fill="none"
            aria-hidden="true"
          >
            {/* Left rays */}
            <line x1="24" y1="46" x2="14" y2="41" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="21" y1="60" x2="10" y2="60" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="24" y1="74" x2="14" y2="79" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
            
            {/* Right rays */}
            <line x1="96" y1="46" x2="106" y2="41" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="99" y1="60" x2="110" y2="60" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="96" y1="74" x2="106" y2="79" stroke="#8B5CF6" strokeWidth="2.8" strokeLinecap="round" />
          </svg>

          {/* 16-Lobed Scalloped Starburst Seal */}
          <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full drop-shadow-md"
            >
              <path
                d={scallopPath}
                fill="#7C3AED"
              />
              <text 
                x="50" 
                y="48" 
                textAnchor="middle" 
                fill="#FFFFFF" 
                fontSize="24" 
                fontWeight="900" 
                fontFamily="system-ui, -apple-system, sans-serif"
                letterSpacing="-0.5"
              >
                20%
              </text>
              <text 
                x="50" 
                y="66" 
                textAnchor="middle" 
                fill="#FFFFFF" 
                fontSize="13" 
                fontWeight="900" 
                letterSpacing="1.5" 
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                OFF
              </text>
            </svg>
          </div>
        </div>

        {/* Community Text */}
        <p className="text-xs sm:text-[13px] text-[#475569] font-medium max-w-[240px] leading-relaxed">
          Join the community and be the first to know about deals.
        </p>

        {/* Main Action Button */}
        <button
          type="button"
          onClick={handleJoinClick}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-98 transition-all duration-200 cursor-pointer mt-4"
          title={`Follow ${channelName} on WhatsApp`}
        >
          <WhiteWhatsAppIcon className="w-5 h-5 text-white shrink-0" />
          <span className="tracking-wide">JOIN WHATSAPP GROUP</span>
        </button>

        {/* Dismissal Link */}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs sm:text-sm font-bold text-[#6366F1] hover:text-[#4F46E5] transition-colors cursor-pointer mt-3.5 py-1 px-3 rounded-lg"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

export default WhatsAppPromoModal;
