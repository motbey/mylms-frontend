import React, { useCallback, useState, useRef } from 'react';
import { useEditor, EditorContent, BubbleMenu, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Mark, mergeAttributes } from '@tiptap/core';

// Custom FontSize mark extension
const FontSize = Mark.create({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => {
          const fontSize = (element as HTMLElement).style.fontSize;
          if (!fontSize) {
            return false;
          }
          return { fontSize };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { fontSize });
        },
      unsetFontSize:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

// Custom FontColor mark extension
const FontColor = Mark.create({
  name: 'fontColor',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }
          return {
            style: `color: ${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => {
          const color = (element as HTMLElement).style.color;
          if (!color) {
            return false;
          }
          return { color };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontColor:
        (color: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { color });
        },
      unsetFontColor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

// Preset colors for the color picker
const FONT_COLOR_PRESETS = [
  '#000000', // Black
  '#374151', // Gray 700
  '#DC2626', // Red
  '#EA580C', // Orange
  '#CA8A04', // Yellow
  '#16A34A', // Green
  '#0891B2', // Cyan
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#DB2777', // Pink
];

interface TipTapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Custom class name for the editor content (overrides default styling) */
  editorClassName?: string;
  /** If true, Enter key won't create new lines (for single-line inputs like headings) */
  singleLine?: boolean;
  /** If true, hides the list buttons from the bubble menu */
  disableLists?: boolean;
}

// Default editor classes
const DEFAULT_EDITOR_CLASS =
  'focus:outline-none text-[18px] leading-relaxed text-gray-900 [&_p]:my-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-3 [&_h4]:text-lg [&_h4]:font-medium [&_h4]:my-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_li]:my-1 [&_a]:text-blue-600 [&_a]:underline [&_mark]:bg-yellow-200 [&_mark]:px-0.5';

const TipTapEditor: React.FC<TipTapEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start writing...',
  editorClassName,
  singleLine = false,
  disableLists = false,
}) => {
  // Build extensions array based on props
  const extensions = [
    StarterKit.configure({
      heading: {
        levels: [2, 3, 4],
      },
      // Disable lists in StarterKit if disableLists is true
      bulletList: disableLists ? false : undefined,
      orderedList: disableLists ? false : undefined,
      listItem: disableLists ? false : undefined,
      // Disable hard break (Shift+Enter) in single line mode
      hardBreak: singleLine ? false : undefined,
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: false,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 underline cursor-pointer',
      },
    }),
    FontSize,
    FontColor,
  ];

  // Add extension to prevent Enter key in single-line mode
  if (singleLine) {
    const PreventEnter = Extension.create({
      name: 'preventEnter',
      addKeyboardShortcuts() {
        return {
          Enter: () => true, // Prevent Enter key
          'Shift-Enter': () => true, // Prevent Shift+Enter too
        };
      },
    });
    extensions.push(PreventEnter);
  }

  const editor = useEditor({
    extensions,
    content: value || `<p>${placeholder}</p>`,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: editorClassName || DEFAULT_EDITOR_CLASS,
      },
    },
  });

  // State for color picker popover
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Apply font size only to the selected text using TipTap's mark system
  const applyFontSizeToSelection = useCallback(
    (fontSize: string) => {
      if (!editor) return;

      // Check if there's a selection
      const { from, to } = editor.state.selection;
      if (from === to) return; // No selection, do nothing

      // Use the custom setFontSize command
      (editor.commands as any).setFontSize(fontSize);
    },
    [editor]
  );

  // Apply font color to selected text
  const applyFontColor = useCallback(
    (color: string) => {
      if (!editor) return;

      // Check if there's a selection
      const { from, to } = editor.state.selection;
      if (from === to) return; // No selection, do nothing

      // Use the custom setFontColor command
      (editor.commands as any).setFontColor(color);
      setCurrentColor(color);
      setShowColorPicker(false);
    },
    [editor]
  );

  // Get current font size from selection (basic detection)
  const getCurrentFontSize = useCallback(() => {
    // Default font size
    return '16';
  }, []);

  const handleLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;

    if (previousUrl) {
      // If there's already a link, remove it
      editor.chain().focus().unsetLink().run();
    } else {
      // Prompt for URL
      const url = window.prompt('Enter URL:', 'https://');
      if (url && url.trim()) {
        editor.chain().focus().setLink({ href: url.trim() }).run();
      }
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  // Button style constants for ISS / MyLMS design – rectangular, larger
  const baseBtn =
    'h-9 px-3 rounded-md flex items-center justify-center text-sm cursor-pointer transition';
  const activeBtn = 'bg-[#E8DDCD] text-[#030037]'; // Sand background + ISS dark blue
  const inactiveBtn = 'text-gray-600 hover:bg-gray-100 hover:text-[#153ac7]';
  const disabledBtn = 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-600';

  return (
    <div className="relative">
      {/* Bubble Menu - appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 150,
          placement: 'top',
          offset: [0, 12],
        }}
        className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-xl min-w-[380px] max-w-[520px]"
      >
        {/* ───────────────────────────────────────────────────────────
            Group 1: Star / Metadata (placeholder)
            TODO: Wire this to a metadata panel for learning fingerprint
        ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={`${baseBtn} ${inactiveBtn}`}
          title="Block metadata (coming soon)"
          onMouseDown={(e) => {
            e.preventDefault();
            console.log('Metadata clicked – coming soon');
          }}
        >
          <span className="text-base">★</span>
        </button>

        {/* Divider */}
        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* ───────────────────────────────────────────────────────────
            Group 2: Text style – Bold, Italic, Underline, Strike
        ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('bold') ? activeBtn : inactiveBtn}`}
          title="Bold (Ctrl+B)"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
        >
          <span className="font-semibold text-base">B</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('italic') ? activeBtn : inactiveBtn}`}
          title="Italic (Ctrl+I)"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
        >
          <span className="italic text-base">I</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('underline') ? activeBtn : inactiveBtn}`}
          title="Underline"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleUnderline().run();
          }}
        >
          <span className="underline underline-offset-2 text-base">U</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('strike') ? activeBtn : inactiveBtn}`}
          title="Strikethrough"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          }}
        >
          <span className="line-through text-base">S</span>
        </button>

        {/* Divider */}
        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* ───────────────────────────────────────────────────────────
            Group 3: Font size dropdown – applies to selection only
        ─────────────────────────────────────────────────────────── */}
        <select
          value={getCurrentFontSize()}
          onChange={(e) => {
            applyFontSizeToSelection(e.target.value + 'px');
          }}
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#153ac7] cursor-pointer"
          title="Font size (applies to selected text)"
        >
          <option value="6">6</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="22">22</option>
          <option value="24">24</option>
          <option value="26">26</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="36">36</option>
          <option value="40">40</option>
          <option value="44">44</option>
          <option value="48">48</option>
          <option value="54">54</option>
          <option value="60">60</option>
          <option value="66">66</option>
          <option value="72">72</option>
          <option value="80">80</option>
          <option value="88">88</option>
          <option value="96">96</option>
          <option value="108">108</option>
          <option value="120">120</option>
          <option value="144">144</option>
        </select>

        {/* Font Color Picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            type="button"
            className={`${baseBtn} ${inactiveBtn}`}
            title="Font color"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
          >
            <span 
              className="text-base font-bold leading-none"
              style={{ color: currentColor }}
            >
              A
            </span>
            <span 
              className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          </button>

          {/* Color Picker Popover */}
          {showColorPicker && (
            <div 
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-4 bg-white rounded-xl border border-gray-200 shadow-xl z-50 w-[240px]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Preset Colors */}
              <div className="grid grid-cols-5 gap-3 mb-4">
                {FONT_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`
                      w-8 h-8 rounded-lg border-2 transition-all hover:scale-110
                      ${currentColor === color ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200'}
                    `}
                    style={{ backgroundColor: color }}
                    onClick={() => applyFontColor(color)}
                  />
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <label className="relative cursor-pointer flex-shrink-0">
                  <div 
                    className="w-8 h-8 rounded-lg border border-gray-300"
                    style={{ backgroundColor: currentColor }}
                  />
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => {
                      const color = e.target.value.toUpperCase();
                      setCurrentColor(color);
                      applyFontColor(color);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                <input
                  type="text"
                  value={currentColor}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (/^#[0-9A-F]{0,6}$/.test(val)) {
                      setCurrentColor(val);
                    }
                  }}
                  onBlur={() => {
                    if (/^#[0-9A-F]{6}$/.test(currentColor)) {
                      applyFontColor(currentColor);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && /^#[0-9A-F]{6}$/.test(currentColor)) {
                      applyFontColor(currentColor);
                    }
                  }}
                  className="w-24 px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="#000000"
                />
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* ───────────────────────────────────────────────────────────
            Group 4: Text Alignment – left, center, right
        ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={`${baseBtn} ${editor.isActive({ textAlign: 'left' }) ? activeBtn : inactiveBtn}`}
          title="Align left"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().setTextAlign('left').run();
          }}
        >
          <span className="text-base leading-none">≡</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive({ textAlign: 'center' }) ? activeBtn : inactiveBtn}`}
          title="Align center"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().setTextAlign('center').run();
          }}
        >
          <span className="text-base leading-none">≣</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive({ textAlign: 'right' }) ? activeBtn : inactiveBtn}`}
          title="Align right"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().setTextAlign('right').run();
          }}
        >
          <span className="text-base leading-none">⫶</span>
        </button>

        {/* Divider */}
        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* ───────────────────────────────────────────────────────────
            Group 5: Lists – bullet, numbered (hidden if disableLists)
        ─────────────────────────────────────────────────────────── */}
        {!disableLists && (
          <>
            <button
              type="button"
              className={`${baseBtn} ${editor.isActive('bulletList') ? activeBtn : inactiveBtn}`}
              title="Bullet list"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().toggleBulletList().run();
              }}
            >
              <span className="text-base leading-none">•</span>
            </button>

            <button
              type="button"
              className={`${baseBtn} ${editor.isActive('orderedList') ? activeBtn : inactiveBtn}`}
              title="Numbered list"
              onMouseDown={(e) => {
                e.preventDefault();
                editor.chain().focus().toggleOrderedList().run();
              }}
            >
              <span className="text-sm leading-none font-medium">1.</span>
            </button>

            {/* Divider */}
            <span className="mx-1 h-5 w-px bg-gray-200" />
          </>
        )}

        {/* ───────────────────────────────────────────────────────────
            Group 6: Highlight + Link
        ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('highlight') ? activeBtn : inactiveBtn}`}
          title="Highlight"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHighlight().run();
          }}
        >
          <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-sm text-gray-800 font-medium">A</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${editor.isActive('link') ? activeBtn : inactiveBtn}`}
          title={editor.isActive('link') ? 'Remove link' : 'Insert / remove link'}
          onMouseDown={(e) => {
            e.preventDefault();
            handleLink();
          }}
        >
          <span className="text-base leading-none">🔗</span>
        </button>

        {/* Divider */}
        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* ───────────────────────────────────────────────────────────
            Group 7: Undo / Redo
        ─────────────────────────────────────────────────────────── */}
        <button
          type="button"
          className={`${baseBtn} ${!editor.can().undo() ? disabledBtn : inactiveBtn}`}
          title="Undo"
          disabled={!editor.can().undo()}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().undo().run();
          }}
        >
          <span className="text-base leading-none">↩</span>
        </button>

        <button
          type="button"
          className={`${baseBtn} ${!editor.can().redo() ? disabledBtn : inactiveBtn}`}
          title="Redo"
          disabled={!editor.can().redo()}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().redo().run();
          }}
        >
          <span className="text-base leading-none">↪</span>
        </button>
      </BubbleMenu>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TipTapEditor;

