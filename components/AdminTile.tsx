import React, { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminTileConfig } from '../config/adminTiles';

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      className={filled ? 'fill-yellow-400 text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}
    />
  </svg>
);

interface AdminTileProps {
  tile: AdminTileConfig;
  isFavorited: boolean;
  onToggleFavorite: (e: MouseEvent) => void;
}

const AdminTile: React.FC<AdminTileProps> = ({ tile, isFavorited, onToggleFavorite }) => {
  const { slug, label, description, to, icon } = tile;

  return (
    <Link to={to} key={slug} className="group block">
      <div className="relative h-full p-6 bg-gradient-to-br from-white to-neutral rounded-xl shadow-md border-2 border-transparent group-hover:border-secondary group-hover:shadow-lg transition-all duration-200 ease-in-out transform group-hover:-translate-y-1">
        <button
          onClick={onToggleFavorite}
          className="absolute top-3 right-3 p-1 rounded-full z-10"
          aria-pressed={isFavorited}
          aria-label={isFavorited ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
        >
          <StarIcon filled={isFavorited} />
        </button>
        <div className="flex flex-col items-start h-full">
          <div className="mb-4">{icon}</div>
          <h2 className="text-xl font-bold text-primary mb-2">{label}</h2>
          <p className="text-sm text-[#858585] flex-grow">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export default AdminTile;
