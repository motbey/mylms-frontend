import React from 'react';

interface RoleBadgeProps {
  role: string;
}

const roleDisplayMap: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
  sub_admin: 'Sub Admin',
  security: 'Security',
};

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const displayText = roleDisplayMap[role] || role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <span className="inline-block px-2.5 py-1 text-xs font-semibold leading-none text-secondary bg-neutral rounded-full uppercase tracking-wide shadow-sm border border-black/5">
      {displayText}
    </span>
  );
};

export default RoleBadge;
