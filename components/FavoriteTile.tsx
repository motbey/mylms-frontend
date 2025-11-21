import React, { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

const StarIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-yellow-400 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783-.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

interface FavoriteTileProps {
  slug: string;
  label: string;
  icon: React.ReactElement<{ className?: string }>;
  to: string;
  onUnfavourite: (slug: string) => void;
  // dnd props
  innerRef: (element: HTMLElement | null) => void;
  draggableProps: DraggableProvidedDraggableProps;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  isDragging: boolean;
}

const FavoriteTile: React.FC<FavoriteTileProps> = ({ slug, label, icon, to, onUnfavourite, innerRef, draggableProps, dragHandleProps, isDragging }) => {
  const compactIcon = React.cloneElement(icon, {
    className: 'h-6 w-6 text-secondary',
  });

  const handleActionClick = (e: MouseEvent, action: (slug: string) => void) => {
    e.preventDefault();
    e.stopPropagation();
    action(slug);
  };

  const draggingClasses = isDragging ? 'shadow-xl scale-105 rotate-1' : 'shadow-sm';

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      className={`relative group ${draggingClasses} transition-all duration-200`}
    >
      <Link
        to={to}
        key={slug}
        className="flex h-full items-center gap-3 p-3 bg-gradient-to-br from-white to-neutral rounded-lg border-2 border-transparent group-hover:border-secondary group-hover:shadow-md"
        aria-label={`Go to ${label}`}
        style={{ transform: 'translateZ(0)' }} // Promote to new layer for smoother animations
      >
        <div>{compactIcon}</div>
        <span className="text-sm font-semibold text-primary">{label}</span>
      </Link>

      {/* Action Buttons Overlay */}
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <button
          onClick={(e) => handleActionClick(e, onUnfavourite)}
          className="p-1 rounded-full text-gray-500 hover:bg-gray-200"
          aria-pressed={true}
          aria-label="Remove from favourites"
        >
          <StarIcon />
        </button>
      </div>
    </div>
  );
};

export default FavoriteTile;