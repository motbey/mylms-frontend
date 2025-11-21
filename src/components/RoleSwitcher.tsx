import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setActiveRole } from '../lib/profiles';

interface RoleSwitcherProps {
  currentRole: 'admin' | 'user';
  roles: string[];
}

const Spinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, roles }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!roles || roles.length <= 1) {
    return null;
  }

  const handleSwitchRole = async () => {
    setLoading(true);
    try {
      const nextRole = currentRole === 'admin' ? 'user' : 'admin';
      await setActiveRole(nextRole);
      
      if (nextRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error("Failed to switch role:", error);
      setLoading(false);
    }
  };

  const nextRoleDisplay = currentRole === 'admin' ? 'User' : 'Admin';

  return (
    <button
      onClick={handleSwitchRole}
      disabled={loading}
      className="bg-secondary text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 transition duration-300 flex items-center justify-center shadow-sm disabled:bg-gray-400 disabled:cursor-wait"
      aria-label={`Switch to ${nextRoleDisplay} view`}
    >
      {loading ? (
        <>
            <Spinner />
            <span>Switching...</span>
        </>
      ) : (
        `Switch to ${nextRoleDisplay}`
      )}
    </button>
  );
};

export default RoleSwitcher;
