import React from 'react';
import { Link } from 'react-router-dom';
import FavoritesSection from '../../components/FavoritesSection';

const AdminGroups: React.FC = () => {
  return (
    <div>
      <div className="bg-white p-8 rounded-lg shadow-md">
        <Link to="/admin" className="text-blue-600 hover:underline mb-6 inline-block">&larr; Back to Admin Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-800">Manage Groups</h1>
        <p className="mt-4 text-gray-600">This is a placeholder page for creating and managing user groups.</p>
      </div>
      <FavoritesSection />
    </div>
  );
};

export default AdminGroups;
