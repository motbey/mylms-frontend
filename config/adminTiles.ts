import React from 'react';

// FIX: Added IconProps interface to allow passing props like className to icon components.
interface IconProps {
  className?: string;
}

// --- SVG Icons for Tiles ---
// FIX: Rewrote icon components with React.createElement to avoid JSX in .ts files and to accept/use the className prop.
const UserIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg',
  { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.273-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.273-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" })
);
const ContentIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg',
  { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" })
);
const ReportsIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg',
  { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" })
);
const SettingsIcon: React.FC<IconProps> = ({ className }) => React.createElement(
  'svg',
  { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
  React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
);
const BellIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg',
    { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" })
);
const GroupsIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg',
    { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" })
);

export interface AdminTileConfig {
  slug: string;
  label: string;
  description: string;
  to: string;
  icon: React.ReactElement;
}

// FIX: Replaced JSX syntax with React.createElement calls, which are valid in .ts files.
export const adminTiles: AdminTileConfig[] = [
  { slug: 'admin.users', label: 'User Management', description: 'Manage users, groups, and access privileges.', to: '/admin/users', icon: React.createElement(UserIcon) },
  { slug: 'admin.groups', label: 'User Groups', description: 'Create and manage dynamic user groups.', to: '/admin/groups', icon: React.createElement(GroupsIcon) },
  { slug: 'admin.content', label: 'Content Management', description: 'Oversee all e-learning, courses, and forms.', to: '/admin/content', icon: React.createElement(ContentIcon) },
  { slug: 'admin.reports', label: 'Reports', description: 'View system-wide reports and analytics.', to: '/admin/reports', icon: React.createElement(ReportsIcon) },
  { slug: 'admin.notifications', label: 'Notifications', description: 'Templates & schedules', to: '/admin/notifications', icon: React.createElement(BellIcon) },
  { slug: 'admin.settings', label: 'System Settings', description: 'Configure global application settings.', to: '/admin/settings', icon: React.createElement(SettingsIcon) },
];

const tilesBySlug = new Map(adminTiles.map(tile => [tile.slug, tile]));

export function getTileBySlug(slug: string): AdminTileConfig | undefined {
  return tilesBySlug.get(slug);
}
