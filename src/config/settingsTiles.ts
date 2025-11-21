import React from 'react';
import { SLUGS } from './slugs';

// --- Icon Type ---
interface IconProps {
  className?: string;
}

// --- Icons for Settings Tiles (converted to work in .ts file) ---
const PaletteIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" })
);
const ImageIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" })
);
const PuzzleIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" })
);
const UserPlusIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" })
);


// --- Tile Configuration ---
export interface SettingsTileConfig {
  slug: string;
  label: string;
  description: string;
  to?: string;
  action?: 'openThemeModal' | 'openLogoModal' | 'openSignupToggleModal';
  icon: React.ReactElement;
}

export const settingsTiles: SettingsTileConfig[] = [
  { slug: SLUGS.SETTINGS_THEMES_TEXT, label: 'Portal Themes & Text', description: 'Customise colours and global text.', action: 'openThemeModal', icon: React.createElement(PaletteIcon) },
  { slug: SLUGS.SETTINGS_LOGO, label: 'Logo', description: 'Upload your company logo.', action: 'openLogoModal', icon: React.createElement(ImageIcon) },
  { slug: SLUGS.SETTINGS_INTEGRATIONS, label: 'Integrations', description: 'Connect with third-party apps.', to: '/admin/settings/integrations', icon: React.createElement(PuzzleIcon) },
  { slug: SLUGS.SETTINGS_SIGNUP_TOGGLE, label: 'Sign-Up Toggle', description: 'Enable or disable public sign-ups.', action: 'openSignupToggleModal', icon: React.createElement(UserPlusIcon) },
];
