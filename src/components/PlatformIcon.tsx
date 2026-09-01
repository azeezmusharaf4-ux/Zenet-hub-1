import React from 'react';
import { normalizeCategory } from '../utils/category';

interface PlatformIconProps {
  category: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export interface PlatformConfig {
  key: string;
  label: string;
  bg: string;
  avatarBg: string;
  badge: string;
  accent: string;
  borderColor: string;
  iconSvg: React.ReactNode;
}

const platformConfigCache = new Map<string, PlatformConfig>();

export const getPlatformConfig = (catStr: string): PlatformConfig => {
  const norm = normalizeCategory(catStr);
  if (platformConfigCache.has(norm)) {
    return platformConfigCache.get(norm)!;
  }
  const config = computePlatformConfig(norm);
  platformConfigCache.set(norm, config);
  return config;
};

const computePlatformConfig = (norm: string): PlatformConfig => {
  switch (norm) {
    case 'Facebook':
      return {
        key: 'Facebook',
        label: 'Facebook',
        bg: 'bg-[#1877F2]',
        avatarBg: 'bg-gradient-to-tr from-[#1877F2] to-blue-700',
        badge: 'bg-blue-950/90 text-blue-300 border-blue-500/40',
        accent: 'text-blue-400',
        borderColor: 'border-blue-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )
      };

    case 'TikTok':
      return {
        key: 'TikTok',
        label: 'TikTok',
        bg: 'bg-black',
        avatarBg: 'bg-gradient-to-tr from-cyan-500 via-slate-900 to-rose-600',
        badge: 'bg-cyan-950/90 text-cyan-300 border-cyan-400/40',
        accent: 'text-cyan-400',
        borderColor: 'border-cyan-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.83.12V9.3a6.33 6.33 0 0 0-1-.08 6.26 6.26 0 1 0 6.26 6.26V9.05a8.21 8.21 0 0 0 5.02 1.74V7.33a4.84 4.84 0 0 1-1-.64z" />
          </svg>
        )
      };

    case 'Instagram':
      return {
        key: 'Instagram',
        label: 'Instagram',
        bg: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]',
        avatarBg: 'bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-700',
        badge: 'bg-pink-950/90 text-pink-300 border-pink-500/40',
        accent: 'text-pink-400',
        borderColor: 'border-pink-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        )
      };

    case 'YouTube':
      return {
        key: 'YouTube',
        label: 'YouTube',
        bg: 'bg-[#FF0000]',
        avatarBg: 'bg-gradient-to-tr from-red-600 to-rose-800',
        badge: 'bg-red-950/90 text-red-300 border-red-500/40',
        accent: 'text-red-400',
        borderColor: 'border-red-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        )
      };

    case 'Gmail':
      return {
        key: 'Gmail',
        label: 'Gmail',
        bg: 'bg-[#EA4335]',
        avatarBg: 'bg-gradient-to-tr from-rose-600 to-red-700',
        badge: 'bg-rose-950/90 text-rose-300 border-rose-500/40',
        accent: 'text-rose-400',
        borderColor: 'border-rose-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        )
      };

    case 'Twitter/X':
      return {
        key: 'Twitter/X',
        label: 'Twitter / X',
        bg: 'bg-black',
        avatarBg: 'bg-gradient-to-tr from-slate-900 to-sky-700',
        badge: 'bg-sky-950/90 text-sky-300 border-sky-400/40',
        accent: 'text-sky-400',
        borderColor: 'border-sky-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )
      };

    case 'Telegram':
      return {
        key: 'Telegram',
        label: 'Telegram',
        bg: 'bg-[#229ED9]',
        avatarBg: 'bg-gradient-to-tr from-sky-400 to-blue-600',
        badge: 'bg-sky-950/90 text-sky-200 border-sky-400/40',
        accent: 'text-sky-300',
        borderColor: 'border-sky-400/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        )
      };

    case 'WhatsApp':
      return {
        key: 'WhatsApp',
        label: 'WhatsApp',
        bg: 'bg-[#25D366]',
        avatarBg: 'bg-gradient-to-tr from-emerald-500 to-teal-700',
        badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-400/40',
        accent: 'text-emerald-400',
        borderColor: 'border-emerald-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        )
      };

    case 'Discord':
      return {
        key: 'Discord',
        label: 'Discord',
        bg: 'bg-[#5865F2]',
        avatarBg: 'bg-gradient-to-tr from-indigo-600 to-purple-800',
        badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-400/40',
        accent: 'text-indigo-400',
        borderColor: 'border-indigo-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        )
      };

    case 'Reddit':
      return {
        key: 'Reddit',
        label: 'Reddit',
        bg: 'bg-[#FF4500]',
        avatarBg: 'bg-gradient-to-tr from-orange-600 to-red-600',
        badge: 'bg-orange-950/90 text-orange-300 border-orange-500/40',
        accent: 'text-orange-400',
        borderColor: 'border-orange-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.056 1.598.02.193.033.39.033.588 0 2.992-3.48 5.418-7.77 5.418s-7.77-2.426-7.77-5.418c0-.198.013-.395.033-.588A1.75 1.75 0 0 1 2.463 12a1.754 1.754 0 0 1 1.754-1.754c.477 0 .899.182 1.207.491 1.194-.856 2.85-1.418 4.674-1.488l.942-4.413 3.28.69a1.248 1.248 0 0 1 1.223-.782zM8.5 13.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm7 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-5.476 4.126a.375.375 0 0 0-.256.64c.801.8 2.101.8 2.902 0a.375.375 0 0 0-.53-.53c-.51.51-1.332.51-1.842 0a.373.373 0 0 0-.274-.11z" />
          </svg>
        )
      };

    case 'Snapchat':
      return {
        key: 'Snapchat',
        label: 'Snapchat',
        bg: 'bg-[#FFFC00]',
        avatarBg: 'bg-gradient-to-tr from-yellow-400 to-amber-500',
        badge: 'bg-yellow-950/90 text-yellow-300 border-yellow-500/40',
        accent: 'text-yellow-400',
        borderColor: 'border-yellow-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-950">
            <path d="M12.003 2c-3.87 0-6.19 2.65-6.38 5.76 0 .39.07.78.14 1.16-.62.15-1.12.39-1.44.75-.41.46-.35 1.04-.21 1.5.18.59.56 1.03.9 1.41-.12.37-.3.73-.55 1.06-.57.75-1.39 1.22-2.19 1.44-.33.09-.5.42-.39.75.22.68.99 1.17 1.88 1.17.31 0 .63-.06.94-.17 1.03-.37 2.13-.15 3.01.52.88.67 2.05 1.15 3.3.15 1.25 1 2.42.52 3.3-.15.88-.67 1.98-.89 3.01-.52.31.11.63.17.94.17.89 0 1.66-.49 1.88-1.17.11-.33-.06-.66-.39-.75-.8-.22-1.62-.69-2.19-1.44-.25-.33-.43-.69-.55-1.06.34-.38.72-.82.9-1.41.14-.46.2-.1-.21-1.5-.32-.36-.82-.6-1.44-.75.07-.38.14-.77.14-1.16-.19-3.11-2.51-5.76-6.38-5.76z" />
          </svg>
        )
      };

    case 'LinkedIn':
      return {
        key: 'LinkedIn',
        label: 'LinkedIn',
        bg: 'bg-[#0A66C2]',
        avatarBg: 'bg-gradient-to-tr from-blue-700 to-sky-800',
        badge: 'bg-blue-950/90 text-blue-200 border-blue-500/40',
        accent: 'text-blue-300',
        borderColor: 'border-blue-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
        )
      };

    case 'Pinterest':
      return {
        key: 'Pinterest',
        label: 'Pinterest',
        bg: 'bg-[#E60023]',
        avatarBg: 'bg-gradient-to-tr from-red-500 to-pink-700',
        badge: 'bg-red-950/90 text-red-300 border-red-500/40',
        accent: 'text-red-400',
        borderColor: 'border-red-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026h.032z" />
          </svg>
        )
      };

    case 'Threads':
      return {
        key: 'Threads',
        label: 'Threads',
        bg: 'bg-black',
        avatarBg: 'bg-gradient-to-tr from-purple-600 to-slate-900',
        badge: 'bg-purple-950/90 text-purple-200 border-purple-500/40',
        accent: 'text-purple-300',
        borderColor: 'border-purple-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-white">
            <path d="M12.186 24c-6.437 0-11.758-4.881-12.153-11.233C-.382 6.138 4.223.479 10.852.025c5.688-.39 10.871 3.225 12.38 8.636a1 1 0 0 1-1.928.528c-1.258-4.508-5.58-7.512-10.312-7.188C5.228 2.388 1.488 7.087 1.838 12.564c.328 5.281 4.747 9.345 10.098 9.345 4.341 0 8.016-2.639 9.362-6.666.257-.768.39-1.57.39-2.386 0-3.842-2.902-6.98-6.733-7.183-3.666-.194-6.868 2.502-7.16 6.09-.272 3.351 2.203 6.223 5.566 6.388 2.062.102 3.992-.796 5.053-2.388a1 1 0 1 1 1.644 1.14c-1.442 2.164-4.053 3.385-6.86 3.245-4.582-.228-7.942-4.148-7.57-8.723.398-4.887 4.757-8.558 9.756-8.293 5.105.27 8.971 4.453 8.971 9.58 0 1.082-.178 2.148-.521 3.172-1.782 5.334-6.657 8.835-12.428 8.835z" />
          </svg>
        )
      };

    default:
      return {
        key: 'Other',
        label: 'Verified Product',
        bg: 'bg-purple-600',
        avatarBg: 'bg-gradient-to-tr from-purple-600 to-indigo-700',
        badge: 'bg-purple-950/90 text-purple-300 border-purple-500/40',
        accent: 'text-purple-400',
        borderColor: 'border-purple-500/50',
        iconSvg: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-white">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        )
      };
  }
};

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  category,
  size = 'md',
  className = ''
}) => {
  const config = getPlatformConfig(category);

  const sizeClasses = {
    xs: 'w-4 h-4 p-0.5',
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1.5',
    lg: 'w-10 h-10 p-2',
    xl: 'w-12 h-12 p-2.5',
    '2xl': 'w-16 h-16 p-3.5'
  }[size];

  return (
    <div
      className={`rounded-xl ${config.bg} flex items-center justify-center shrink-0 shadow-md ${sizeClasses} ${className}`}
      title={`${config.label} Platform`}
    >
      {config.iconSvg}
    </div>
  );
};
