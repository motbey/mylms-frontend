import React, { useEffect, useRef } from 'react';
import Quill from 'quill';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  
  // Use a ref to hold the latest onChange callback. This prevents the initialization
  // effect from re-running every time the parent component re-renders.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // This effect should only run once to initialize the Quill editor.
  useEffect(() => {
    // Exit if the container isn't ready or if Quill is already initialized.
    if (!containerRef.current || quillRef.current) {
      return;
    }

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
        ],
      },
    });
    quillRef.current = quill;

    // Set initial content if a value is provided.
    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }

    // Listener for text changes within the editor.
    const handleChange = () => {
      const html = quill.root.innerHTML;
      // When the editor is cleared, it leaves an empty paragraph tag.
      // We'll treat this as an empty string.
      const cleanHtml = html === '<p><br></p>' ? '' : html;
      
      // Use the ref to call the latest onChange handler.
      onChangeRef.current(cleanHtml);
    };

    quill.on('text-change', handleChange);

    // Cleanup function to be called when the component unmounts.
    return () => {
      quill.off('text-change', handleChange);
      // Ensure the quill instance is destroyed to prevent memory leaks.
      if (quillRef.current) {
        quillRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // The empty dependency array ensures this effect runs only once on mount.
    // Placeholder is part of the initial config and shouldn't change.
  }, [placeholder]);

  // This effect handles programmatic changes to the `value` prop from outside the editor.
  useEffect(() => {
    const quill = quillRef.current;
    if (quill) {
      const currentContent = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
      
      // Only update the editor's content if it's different from the incoming `value` prop
      // and if the editor is not currently focused by the user. This prevents the cursor
      // from jumping to the end of the text while the user is typing.
      if (value !== currentContent && !quill.hasFocus()) {
        quill.clipboard.dangerouslyPasteHTML(value || '');
      }
    }
  }, [value]);

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <div
        ref={containerRef}
        className="quill-editor"
      />
    </div>
  );
};

export default RichTextEditor;