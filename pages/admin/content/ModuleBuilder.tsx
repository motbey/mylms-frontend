import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

// Lesson item type
type LessonItem = {
  id: string;
  title: string;
  pageId?: string | null; // present if this lesson already has a page in DB
  orderIndex?: number; // order_index from content_module_pages
};

const ModuleBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { moduleId: moduleIdParam } = useParams<{ moduleId: string }>();

  // Editable module title and description state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Lessons state
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [openLessonMenuId, setOpenLessonMenuId] = useState<string | null>(null);

  // Delete lesson modal state
  const [lessonToDelete, setLessonToDelete] = useState<LessonItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline lesson title editing state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState<string>('');

  // Supabase save state
  const [moduleId, setModuleId] = useState<string | null>(moduleIdParam ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingModule, setIsLoadingModule] = useState(false);

  // Author state (from authenticated user)
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorInitials, setAuthorInitials] = useState<string>('?');
  const [authorLoading, setAuthorLoading] = useState(true);

  // Author visibility + menu state
  const [showAuthor, setShowAuthor] = useState(true);
  const [authorMenuOpen, setAuthorMenuOpen] = useState(false);

  // Ref for click-outside detection
  const authorMenuRef = useRef<HTMLDivElement>(null);

  // Load current user and profile on mount
  useEffect(() => {
    const loadUser = async () => {
      setAuthorLoading(true);

      // 1. Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('No authenticated user found', userError);
        setAuthorName(null);
        setAuthorInitials('?');
        setAuthorLoading(false);
        return;
      }

      // 2. Fetch profile from profiles table
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile', profileError);
      }

      // 3. Compute display name from profile (with fallbacks)
      let displayName = user.email ?? '';

      if (profile && !profileError) {
        const parts: string[] = [];
        if (profile.first_name) parts.push(profile.first_name);
        if (profile.last_name) parts.push(profile.last_name);
        if (parts.length > 0) {
          displayName = parts.join(' ');
        } else if (profile.email) {
          displayName = profile.email;
        }
      }

      // 4. Compute initials from display name
      const makeInitials = (nameOrEmail: string): string => {
        const trimmed = nameOrEmail.trim();
        if (!trimmed) return '?';

        const words = trimmed.split(/\s+/);
        if (words.length >= 2) {
          return (
            words[0].charAt(0).toUpperCase() +
            words[words.length - 1].charAt(0).toUpperCase()
          );
        }

        // Single word or email - take first character
        return trimmed.charAt(0).toUpperCase();
      };

      setAuthorName(displayName);
      setAuthorInitials(makeInitials(displayName));
      setAuthorLoading(false);
    };

    loadUser();
  }, []);

  // Load existing module and lessons when moduleIdParam is present
  useEffect(() => {
    const loadModule = async () => {
      if (!moduleIdParam) return;

      setIsLoadingModule(true);

      // 1) Load the module (title + description)
      const { data: module, error: moduleError } = await supabase
        .from('content_modules')
        .select('id, title, description')
        .eq('id', moduleIdParam)
        .single();

      if (moduleError) {
        console.error('Error loading module', moduleError);
        setIsLoadingModule(false);
        return;
      }

      setModuleId(module.id);
      setTitle(module.title ?? '');
      setDescription(module.description ?? '');

      // 2) Load the pages as lessons
      const { data: pages, error: pagesError } = await supabase
        .from('content_module_pages')
        .select('id, title, order_index')
        .eq('module_id', module.id)
        .order('order_index', { ascending: true });

      if (pagesError) {
        console.error('Error loading module pages', pagesError);
      } else if (pages) {
        const mappedLessons: LessonItem[] = pages.map((p) => ({
          id: p.id as string,
          title: p.title as string,
          pageId: p.id as string, // marks that this lesson already has content
          orderIndex: (p.order_index as number) ?? 0,
        }));
        setLessons(mappedLessons);
      }

      setIsLoadingModule(false);
    };

    // Only load if we came in with a moduleIdParam
    if (moduleIdParam) {
      loadModule();
    }
  }, [moduleIdParam]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        authorMenuRef.current &&
        !authorMenuRef.current.contains(event.target as Node)
      ) {
        setAuthorMenuOpen(false);
      }
    };

    if (authorMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [authorMenuOpen]);

  const handleSaveModule = async (): Promise<string | null> => {
    setError(null);

    if (!title.trim()) {
      console.warn('Module title is empty, not saving.');
      return null;
    }

    setIsSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('No authenticated user found', userError);
      setError('You must be logged in to save a module.');
      setIsSaving(false);
      return null;
    }

    // If module already exists, do an update
    if (moduleId) {
      const { error: updateError } = await supabase
        .from('content_modules')
        .update({
          title: title.trim(),
          description: description.trim() || null,
        })
        .eq('id', moduleId);

      if (updateError) {
        console.error('Error updating module', updateError);
        setError('Failed to update module.');
        setIsSaving(false);
        return null;
      }

      console.log('Module updated:', moduleId);
      setIsSaving(false);
      return moduleId;
    }

    // Otherwise, insert a new module
    const { data, error: insertError } = await supabase
      .from('content_modules')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving module', insertError);
      setError('Failed to save module.');
      setIsSaving(false);
      return null;
    }

    if (data) {
      setModuleId(data.id);
      console.log('Module created with id:', data.id);
      setIsSaving(false);
      return data.id;
    }

    setIsSaving(false);
    return null;
  };

  const handleCreateLessonFor = async (lessonId: string) => {
    // Find lesson in local state
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    // Ensure module is saved
    let currentModuleId = moduleId;

    if (!currentModuleId) {
      // Auto-save the module first
      currentModuleId = await handleSaveModule();
    }

    if (!currentModuleId) {
      console.warn('Cannot create lesson without a saved module.');
      setError('Please enter a module title and save first.');
      return;
    }

    // Insert page into content_module_pages
    const lessonIndex = lessons.findIndex((l) => l.id === lessonId);

    const { data, error: insertError } = await supabase
      .from('content_module_pages')
      .insert({
        module_id: currentModuleId,
        title: lesson.title,
        order_index: lessonIndex,
        status: 'draft',
        difficulty_level: 'standard',
        is_core: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating lesson page', insertError);
      setError('Failed to create lesson.');
      return;
    }

    const pageId = data.id as string;
    console.log('Lesson page created with id:', pageId);

    // Mark lesson as having a page
    setLessons((prev) =>
      prev.map((l) =>
        l.id === lessonId ? { ...l, pageId } : l
      )
    );

    // Navigate to Lesson Builder
    navigate(`/admin/content/module-builder/${currentModuleId}/lessons/${pageId}`);
  };

  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;

    setIsDeleting(true);

    // If this lesson has a pageId, delete from database
    if (lessonToDelete.pageId) {
      // First delete all blocks associated with this page
      const { error: blocksError } = await supabase
        .from('content_module_blocks')
        .delete()
        .eq('page_id', lessonToDelete.pageId);

      if (blocksError) {
        console.error('Error deleting lesson blocks', blocksError);
        setError('Failed to delete lesson blocks.');
        setIsDeleting(false);
        return;
      }

      // Then delete the page itself
      const { error: pageError } = await supabase
        .from('content_module_pages')
        .delete()
        .eq('id', lessonToDelete.pageId);

      if (pageError) {
        console.error('Error deleting lesson page', pageError);
        setError('Failed to delete lesson.');
        setIsDeleting(false);
        return;
      }
    }

    // Remove from UI
    setLessons((prev) => prev.filter((l) => l.id !== lessonToDelete.id));
    setLessonToDelete(null);
    setIsDeleting(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside the list or in the same position
    if (!destination || source.index === destination.index) {
      return;
    }

    // Reorder the lessons array
    const reorderedLessons = [...lessons];
    const [movedLesson] = reorderedLessons.splice(source.index, 1);
    reorderedLessons.splice(destination.index, 0, movedLesson);

    // Update state immediately for responsive UI
    setLessons(reorderedLessons);

    // Persist new order to Supabase for lessons that have a pageId
    const updates = reorderedLessons
      .map((lesson, index) => ({
        id: lesson.pageId, // only update if we have a pageId
        order_index: index,
      }))
      .filter((row) => row.id); // filter out lessons without pageId

    if (updates.length > 0) {
      try {
        // Update all at once using Promise.all
        await Promise.all(
          updates.map((row) =>
            supabase
              .from('content_module_pages')
              .update({ order_index: row.order_index })
              .eq('id', row.id)
          )
        );
        console.log('Lesson order saved to database');
      } catch (err) {
        console.error('Error saving lesson order', err);
        // Optionally show an error toast here
      }
    }
  };

  const handleDuplicateLesson = async (lesson: LessonItem) => {
    try {
      if (!lesson.pageId || !moduleId) {
        console.warn('Cannot duplicate lesson without pageId or moduleId');
        return;
      }

      // Fetch the full page row so we can copy description/status etc.
      const { data: page, error: pageError } = await supabase
        .from('content_module_pages')
        .select('id, title, description, status')
        .eq('id', lesson.pageId)
        .single();

      if (pageError || !page) {
        console.error('Error loading page to duplicate', pageError);
        setError('Failed to load lesson for duplication.');
        return;
      }

      // Decide on copy title
      const baseTitle: string = page.title ?? '';
      const copyTitle = baseTitle.endsWith('(Copy)')
        ? baseTitle
        : `${baseTitle} (Copy)`;

      // Find next order index for this module
      const maxOrder =
        lessons.length > 0
          ? Math.max(
              ...lessons
                .map((l) => l.orderIndex ?? 0)
                .filter((n) => Number.isFinite(n))
            )
          : 0;

      const { data: inserted, error: insertError } = await supabase
        .from('content_module_pages')
        .insert({
          module_id: moduleId,
          title: copyTitle,
          description: page.description ?? null,
          status: page.status ?? 'draft',
          order_index: maxOrder + 1,
          difficulty_level: 'standard',
          is_core: true,
        })
        .select('id, title, order_index')
        .single();

      if (insertError || !inserted) {
        console.error('Error duplicating lesson', insertError);
        setError('Failed to duplicate lesson.');
        return;
      }

      // Update local lessons state – new lesson at the end
      setLessons((prev) => [
        ...prev,
        {
          id: inserted.id as string,
          pageId: inserted.id as string,
          title: (inserted.title as string) ?? copyTitle,
          orderIndex: (inserted.order_index as number) ?? maxOrder + 1,
        },
      ]);

      console.log('Lesson duplicated with id:', inserted.id);
    } catch (err) {
      console.error('Unexpected error duplicating lesson', err);
      setError('An unexpected error occurred while duplicating.');
    }
  };

  // Inline lesson title editing helpers
  const startEditingLessonTitle = (lesson: LessonItem) => {
    setEditingLessonId(lesson.pageId ?? lesson.id);
    setEditingLessonTitle(lesson.title ?? '');
  };

  const saveLessonTitle = async () => {
    if (!editingLessonId) return;

    const trimmed = editingLessonTitle.trim();
    if (!trimmed) {
      // Don't allow empty titles – just cancel and keep old value
      setEditingLessonId(null);
      return;
    }

    // Optimistically update local state
    setLessons((prev) =>
      prev.map((lesson) =>
        (lesson.pageId ?? lesson.id) === editingLessonId
          ? { ...lesson, title: trimmed }
          : lesson
      )
    );

    const currentId = editingLessonId;
    setEditingLessonId(null);

    // Only update in Supabase if this lesson has a pageId (exists in DB)
    const lessonToUpdate = lessons.find(
      (l) => (l.pageId ?? l.id) === currentId
    );
    if (lessonToUpdate?.pageId) {
      try {
        const { error } = await supabase
          .from('content_module_pages')
          .update({ title: trimmed })
          .eq('id', currentId);

        if (error) {
          console.error('Error updating lesson title', error);
        }
      } catch (err) {
        console.error('Unexpected error updating lesson title', err);
      }
    }
  };

  const cancelLessonTitleEdit = () => {
    setEditingLessonId(null);
    setEditingLessonTitle('');
  };

  if (isLoadingModule) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading module...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-8 pt-12 pb-24">
        {/* Breadcrumb */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/content/elearning')}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Back to E-Learning Content
          </button>
        </div>

        {/* Editable Course Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Course Title"
          className="w-full text-4xl font-light text-gray-700 placeholder:text-gray-400 focus:outline-none border-b border-transparent focus:border-orange-500 bg-transparent mb-6"
        />

        {/* Show Author button (when author is hidden) */}
        {!authorLoading && !showAuthor && authorName && (
          <button
            type="button"
            onClick={() => setShowAuthor(true)}
            className="mb-4 text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Show author
          </button>
        )}

        {/* Author Row with Dropdown + Save Button */}
        <div className="flex items-center justify-between mb-8">
          {/* Author Avatar + Name with Dropdown */}
          {showAuthor && authorName && (
            <div className="relative" ref={authorMenuRef}>
              <button
                type="button"
                onClick={() => setAuthorMenuOpen((open) => !open)}
                className="flex items-center gap-3 text-gray-700 hover:text-gray-900 focus:outline-none"
              >
                <div className="h-10 w-10 rounded-full bg-[#4a90a4] text-white flex items-center justify-center text-sm font-semibold">
                  {authorInitials}
                </div>
                <span className="font-medium">{authorName}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    authorMenuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Author Dropdown Menu */}
              {authorMenuOpen && (
                <div className="absolute mt-3 w-56 rounded-md bg-white shadow-lg border border-gray-100 z-10">
                  {/* Author info row */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="h-8 w-8 rounded-full bg-[#4a90a4] text-white flex items-center justify-center text-xs font-semibold">
                      {authorInitials}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {authorName}
                    </span>
                  </div>
                  {/* Hide Author option */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthor(false);
                      setAuthorMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                    <span>Hide Author</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Placeholder when author is hidden or loading */}
          {(!showAuthor || !authorName) && <div />}

          {/* Save Module Button */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSaveModule}
              disabled={isSaving || !title.trim()}
              className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save module'}
            </button>
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        </div>

        {/* Orange Underline Bar */}
        <div className="h-1 w-36 bg-orange-500 mb-16" />

        {/* Course Description */}
        <div className="mb-16 max-w-3xl">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your course..."
            rows={3}
            className="w-full resize-none text-lg text-gray-700 placeholder:text-gray-400 bg-transparent border-b border-gray-200 focus:border-orange-500 focus:outline-none pb-2"
          />
        </div>

        {/* Lessons List with Drag and Drop */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="lessons-list">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`transition-colors rounded-lg ${
                  snapshot.isDraggingOver ? 'bg-orange-50/50' : ''
                }`}
              >
                {lessons.map((lesson, index) => (
                  <Draggable
                    key={lesson.id}
                    draggableId={`lesson-${lesson.id}`}
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`py-4 border-b border-gray-200 flex items-center justify-between transition-all ${
                          snapshot.isDragging
                            ? 'bg-white shadow-lg rounded-lg border border-gray-200 z-50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1 shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical size={18} />
                          </div>

                          {/* Title / inline editor */}
                          <div className="flex-1 min-w-0">
                            {editingLessonId === (lesson.pageId ?? lesson.id) ? (
                              <input
                                type="text"
                                value={editingLessonTitle}
                                onChange={(e) => setEditingLessonTitle(e.target.value)}
                                onBlur={saveLessonTitle}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void saveLessonTitle();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelLessonTitleEdit();
                                  }
                                }}
                                autoFocus
                                className="w-full rounded border border-orange-400 px-2 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingLessonTitle(lesson)}
                                className="text-left font-semibold text-gray-800 hover:text-orange-600 hover:underline truncate block w-full"
                              >
                                {lesson.title || 'Untitled lesson'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative">
                            {lesson.pageId ? (
                              // EDIT CONTENT button for lessons that already have a page
                              <button
                                type="button"
                                onClick={() => {
                                  if (!moduleId || !lesson.pageId) return;
                                  navigate(`/admin/content/module-builder/${moduleId}/lessons/${lesson.pageId}`);
                                }}
                                className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Edit Content
                              </button>
                            ) : (
                              // ADD CONTENT dropdown for lessons without a page
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenLessonMenuId((current) =>
                                      current === lesson.id ? null : lesson.id
                                    )
                                  }
                                  className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 focus:outline-none"
                                >
                                  Add Content
                                  <span className="ml-1 text-xs">▾</span>
                                </button>

                                {openLessonMenuId === lesson.id && (
                                  <div className="absolute right-0 mt-2 w-60 rounded-md bg-white shadow-lg border border-gray-100 z-10">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleCreateLessonFor(lesson.id);
                                        setOpenLessonMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100"
                                    >
                                      <div className="font-semibold text-gray-900">Create Lesson</div>
                                      <div className="text-xs text-gray-500">
                                        Create a new lesson from a wide range of learning blocks.
                                      </div>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        console.log('Create Quiz clicked for', lesson.id);
                                        setOpenLessonMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                                    >
                                      <div className="font-semibold text-gray-900">Create Quiz</div>
                                      <div className="text-xs text-gray-500">
                                        Test the learner&apos;s knowledge with a quiz.
                                      </div>
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Duplicate lesson button - only show if lesson has a pageId */}
                          {lesson.pageId && (
                            <button
                              type="button"
                              onClick={() => handleDuplicateLesson(lesson)}
                              className="inline-flex items-center rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              title="Duplicate lesson"
                            >
                              Duplicate
                            </button>
                          )}

                          {/* Delete lesson button */}
                          <button
                            type="button"
                            onClick={() => setLessonToDelete(lesson)}
                            className="p-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-100 hover:border-gray-400 transition-colors"
                            title="Delete lesson"
                          >
                            <svg
                              className="w-4 h-4 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add Lesson Input Row */}
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl leading-none text-gray-400">•</span>
            <input
              type="text"
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder="Add a lesson title..."
              className="flex-1 bg-transparent border-none focus:outline-none text-gray-600 placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const trimmed = newLessonTitle.trim();
                  if (!trimmed) return;

                  const id =
                    typeof crypto !== 'undefined' && 'randomUUID' in crypto
                      ? crypto.randomUUID()
                      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

                  setLessons((prev) => [...prev, { id, title: trimmed }]);
                  setNewLessonTitle('');
                }
              }}
            />
          </div>
          <div className="ml-4 text-xs text-gray-400">
            Shift + Enter to add as a section
          </div>
        </div>

        <div className="border-b border-gray-200" />

        {/* Empty space below - this is where future content would go */}
      </div>

      {/* Delete Lesson Confirmation Modal */}
      {lessonToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isDeleting && setLessonToDelete(null)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete lesson?
              </h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete{' '}
                <span className="font-medium text-gray-800">
                  &quot;{lessonToDelete.title}&quot;
                </span>
                ? This cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLessonToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLesson}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete lesson'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleBuilder;
