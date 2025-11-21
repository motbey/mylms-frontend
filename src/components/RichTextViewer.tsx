import React from 'react';

interface RichTextViewerProps {
  html: string;
  className?: string;
}

const RichTextViewer: React.FC<RichTextViewerProps> = ({ html, className }) => {
  // Return null if there's no HTML to render to avoid an empty div
  if (!html || html.trim() === '' || html.trim() === '<p><br></p>') {
    return null;
  }

  return (
    <div
      className={`prose max-w-none text-sm text-gray-600 ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default RichTextViewer;
