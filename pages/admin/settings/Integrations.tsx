import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DatabaseConnectionModal from './components/DatabaseConnectionModal';
import FavoritesSection from '../../../components/FavoritesSection';

// --- SVG Icon for the new tile ---
const DatabaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7a8 8 0 0116 0M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
);

const AdminIntegrations: React.FC = () => {
    const [dbModalOpen, setDbModalOpen] = useState(false);

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <Link to="/admin/settings" className="text-blue-600 hover:underline text-sm">&larr; Back to System Settings</Link>
            </div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Integrations</h1>
                <p className="text-gray-500">Connect your LMS with other tools and services.</p>
            </div>
            
            <FavoritesSection />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Database Connection Tile */}
                <div className="p-6 bg-gradient-to-br from-white to-neutral rounded-xl shadow-md border-2 border-transparent flex flex-col justify-between min-h-40">
                    <div>
                        <div className="mb-4"><DatabaseIcon /></div>
                        <h2 className="text-xl font-bold text-primary mb-2">Database Connection</h2>
                        <p className="text-sm text-[#858585] flex-grow">Test connectivity to your Supabase database.</p>
                    </div>
                    <div className="mt-4">
                        <button 
                            onClick={() => setDbModalOpen(true)}
                            className="w-full sm:w-auto bg-secondary text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 transition duration-300"
                            aria-label="Open database connection test modal"
                        >
                            Test Connection
                        </button>
                    </div>
                </div>
                {/* Other integration tiles can be added here in the future */}
            </div>

            <DatabaseConnectionModal
                isOpen={dbModalOpen}
                onClose={() => setDbModalOpen(false)}
            />
        </div>
    );
};

export default AdminIntegrations;
