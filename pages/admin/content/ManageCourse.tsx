import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { supabase } from "../../../lib/supabaseClient";
import {
  Course,
  listCourseItemsForCourse,
  CourseItemRecord,
  saveCourseItemsForCourse,
  CourseItemInput,
} from "../../../src/lib/api/courses";
import { listScormModules } from "../../../src/lib/api/scorm";
import { listForms } from "../../../src/lib/api/forms";
import {
  GripVertical,
  Plus,
  Trash2,
  FileText,
  Package,
  Award,
  Users,
  ClipboardList,
  Save,
  AlertCircle,
  X,
  Check,
} from "lucide-react";

// --- Reusable Components ---

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-lg transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col mt-20">
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCompletionRule = (rule: string, requiredNum: number | null) => {
  switch (rule) {
    case "all":
      return "All items required";
    case "sequence":
      return "Sequential order";
    case "any_x_of_y":
      return `Any ${requiredNum ?? "X"} items`;
    default:
      return rule;
  }
};

// Mapping for item types to labels and icons
const itemTypesConfig: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  scorm: { label: "SCORM Module", icon: Package },
  form: { label: "Form", icon: FileText },
  competency: { label: "Competency", icon: Award },
  workshop: { label: "Workshop", icon: Users },
  assignment: { label: "Assignment", icon: ClipboardList },
};

// Items available in the palette
const paletteItems = [
  { type: "scorm", label: "SCORM Module" },
  { type: "form", label: "Form" },
  { type: "competency", label: "Competency" },
  { type: "workshop", label: "Workshop" },
  { type: "assignment", label: "Assignment" },
];

// Extended type to hold UI state (like labels for selected content)
type CourseItemState = CourseItemRecord & {
  item_label?: string | null;
};

const ManageCourse: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Course Items State
  const [items, setItems] = useState<CourseItemState[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Dirty state for unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Content Picker State
  const [isContentPickerOpen, setIsContentPickerOpen] = useState(false);
  const [contentPickerItemId, setContentPickerItemId] = useState<string | null>(
    null
  );
  const [contentPickerType, setContentPickerType] = useState<
    "scorm" | "form" | null
  >(null);
  const [contentOptions, setContentOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null
  );
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered content options based on search query
  const filteredContentOptions = contentOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Course not found.");

        setCourse(data as Course);
      } catch (err: any) {
        console.error("Error loading course:", err);
        setError(err.message || "Failed to load course details.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  // Helper to fetch labels for existing items
  const fetchItemLabel = async (
    item: CourseItemRecord
  ): Promise<string | null> => {
    if (!item.item_id) return null;

    if (item.item_type === "scorm") {
      const { data } = await supabase
        .from("modules")
        .select("title")
        .eq("id", item.item_id)
        .single();
      return data?.title || null;
    } else if (item.item_type === "form") {
      const { data } = await supabase
        .from("forms")
        .select("name")
        .eq("id", item.item_id)
        .single();
      return data?.name || null;
    }
    return null;
  };

  useEffect(() => {
    if (!course?.id) return;
    let cancelled = false;

    const loadItems = async () => {
      try {
        setItemsLoading(true);
        setItemsError(null);
        const data = await listCourseItemsForCourse(course.id);

        if (!cancelled) {
          // Enhance items with labels
          const enhancedItems = await Promise.all(
            data.map(async (item) => {
              const label = await fetchItemLabel(item);
              return { ...item, item_label: label };
            })
          );

          setItems(enhancedItems);
          setIsDirty(false);
        }
      } catch (err: any) {
        console.error("Failed to load course items", err);
        if (!cancelled) setItemsError("Failed to load course items.");
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    };

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [course?.id]);

  // --- Drag and Drop Handlers ---

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Reordering within the list
    if (
      source.droppableId === "course-items" &&
      destination.droppableId === "course-items"
    ) {
      if (source.index === destination.index) return;

      const newItems = [...items];
      const [movedItem] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, movedItem);

      const updatedItems = newItems.map((item, index) => ({
        ...item,
        sort_index: index,
      }));

      setItems(updatedItems);
      setIsDirty(true);
      return;
    }

    // Dropping from Palette to List
    if (
      source.droppableId === "palette" &&
      destination.droppableId === "course-items"
    ) {
      if (!courseId) return;

      const type = draggableId.replace("palette-", "") as any;

      const newItem: CourseItemState = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        course_id: courseId,
        item_type: type,
        item_id: null,
        sort_index: destination.index,
        is_required: true,
        created_at: new Date().toISOString(),
        item_label: null,
      };

      const newItems = [...items];
      newItems.splice(destination.index, 0, newItem);

      const updatedItems = newItems.map((item, index) => ({
        ...item,
        sort_index: index,
      }));

      setItems(updatedItems);
      setIsDirty(true);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems.map((item, idx) => ({ ...item, sort_index: idx })));
    setIsDirty(true);
  };

  const handleToggleRequired = (index: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      is_required: !newItems[index].is_required,
    };
    setItems(newItems);
    setIsDirty(true);
  };

  const handleSaveCourseItems = async () => {
    if (!courseId) return;
    setIsSaving(true);
    try {
      const itemsToSave: CourseItemInput[] = items.map((item) => ({
        item_type: item.item_type as any,
        item_id: item.item_id || null,
        is_required: item.is_required,
      }));

      await saveCourseItemsForCourse(courseId, itemsToSave);

      // Reload to get real IDs
      const refreshedData = await listCourseItemsForCourse(courseId);
      // Re-fetch labels for the fresh data
      const enhancedItems = await Promise.all(
        refreshedData.map(async (item) => {
          const label = await fetchItemLabel(item);
          return { ...item, item_label: label };
        })
      );

      setItems(enhancedItems);
      setIsDirty(false);
      alert("Course items saved successfully!");
    } catch (err) {
      console.error("Failed to save course items:", err);
      alert("Failed to save changes. See console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Content Picker Logic ---

  const openContentPicker = async (
    itemId: string,
    itemType: "scorm" | "form"
  ) => {
    setContentPickerItemId(itemId);
    setContentPickerType(itemType);
    setIsContentPickerOpen(true);
    setIsLoadingContent(true);
    setSelectedContentId(null);
    setContentOptions([]);

    try {
      let options: { id: string; label: string }[] = [];

      if (itemType === "scorm") {
        const modules = await listScormModules();
        options = modules.map((m) => ({ id: m.id, label: m.title }));
      } else if (itemType === "form") {
        const forms = await listForms();
        options = forms.map((f) => ({ id: f.id, label: f.name }));
      }

      setContentOptions(options);
    } catch (err) {
      console.error("openContentPicker error", err);
      alert("Failed to load content options");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const applySelectedContent = () => {
    if (!contentPickerItemId || !contentPickerType || !selectedContentId) {
      setIsContentPickerOpen(false);
      return;
    }

    const selectedOption = contentOptions.find(
      (opt) => opt.id === selectedContentId
    );

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === contentPickerItemId) {
          return {
            ...item,
            item_id: selectedContentId,
            item_label: selectedOption?.label || null,
          };
        }
        return item;
      })
    );

    setIsDirty(true);
    setIsContentPickerOpen(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading course...</div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <p className="text-red-600 mb-4">{error || "Course not found."}</p>
        <Link
          to="/admin/content/courses"
          className="text-secondary hover:underline"
        >
          &larr; Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/content/courses"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to Courses
          </Link>
          <h1 className="text-3xl font-bold text-primary mt-2">
            Manage Course
          </h1>
          <p className="mt-1 text-gray-600 font-medium">{course.title}</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-3 animate-pulse">
            <span className="text-amber-600 text-sm font-medium flex items-center gap-1">
              <AlertCircle size={16} /> Unsaved changes
            </span>
          </div>
        )}
      </div>

      {/* Course Details Card */}
      <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Course Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <span className="block text-gray-500 mb-1">Title</span>
            <span className="font-medium text-gray-900 text-base">
              {course.title}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Category</span>
            <span className="font-medium text-gray-900">
              {course.category || "—"}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Completion Rule</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {formatCompletionRule(
                course.completion_rule,
                course.completion_required_number
              )}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Created At</span>
            <span className="font-medium text-gray-900">
              {formatDate(course.created_at)}
            </span>
          </div>
          <div className="md:col-span-2">
            <span className="block text-gray-500 mb-1">Description</span>
            <span className="font-medium text-gray-900 whitespace-pre-wrap">
              {course.description || (
                <span className="text-gray-400 italic">
                  No description provided.
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Builder Area */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Course Items List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100 min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">
                  Course Content
                </h2>
                <button
                  onClick={handleSaveCourseItems}
                  disabled={!isDirty || isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {itemsLoading ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Loading items...
                </div>
              ) : itemsError ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                  {itemsError}
                </div>
              ) : (
                <Droppable droppableId="course-items">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 space-y-3 p-2 rounded-lg transition-colors ${
                        snapshot.isDraggingOver ? "bg-blue-50/50" : ""
                      }`}
                    >
                      {items.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-10">
                          <Package size={48} className="mb-3 opacity-20" />
                          <p>No items yet.</p>
                          <p className="text-sm">
                            Drag items from the palette to add them.
                          </p>
                        </div>
                      )}

                      {items.map((item, index) => {
                        const config = itemTypesConfig[item.item_type] || {
                          label: "Unknown",
                          icon: Package,
                        };
                        const Icon = config.icon;
                        const canPickContent =
                          item.item_type === "scorm" ||
                          item.item_type === "form";

                        return (
                          <Draggable
                            key={item.id}
                            draggableId={`course-item-${item.id}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group flex items-center gap-4 p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all ${
                                  snapshot.isDragging
                                    ? "ring-2 ring-secondary rotate-1 z-50"
                                    : "border-gray-200"
                                }`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical size={20} />
                                </div>

                                <div className="p-2 bg-gray-50 rounded-lg text-secondary">
                                  <Icon size={20} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-800">
                                      {config.label}
                                    </span>
                                    {item.id.startsWith("temp-") && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                                        New
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span
                                      className={`truncate ${
                                        item.item_id
                                          ? "text-gray-900 font-medium"
                                          : "text-gray-400 italic"
                                      }`}
                                    >
                                      {item.item_label || "No content selected"}
                                    </span>
                                    {canPickContent && (
                                      <button
                                        onClick={() =>
                                          openContentPicker(
                                            item.id,
                                            item.item_type as any
                                          )
                                        }
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                      >
                                        {item.item_id
                                          ? "Change"
                                          : "Select Content"}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 border-l pl-4 border-gray-100">
                                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 hover:text-gray-900 select-none">
                                    <input
                                      type="checkbox"
                                      checked={item.is_required ?? true}
                                      onChange={() =>
                                        handleToggleRequired(index)
                                      }
                                      className="rounded border-gray-300 text-secondary focus:ring-secondary"
                                    />
                                    Required
                                  </label>

                                  <button
                                    onClick={() => handleRemoveItem(index)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>

          {/* Right: Item Palette */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100 sticky top-24">
              <h2 className="text-xl font-bold text-primary mb-4">
                Item Palette
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Drag an item type to add it to the course.
              </p>

              <Droppable droppableId="palette" isDropDisabled={true}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {paletteItems.map((item, index) => {
                      const Icon = itemTypesConfig[item.type]?.icon || Package;
                      return (
                        <Draggable
                          key={item.type}
                          draggableId={`palette-${item.type}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-secondary hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${
                                snapshot.isDragging
                                  ? "ring-2 ring-secondary z-50"
                                  : ""
                              }`}
                            >
                              <div className="text-gray-500">
                                <Icon size={18} />
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {item.label}
                              </span>
                              <div className="ml-auto text-gray-300">
                                <Plus size={16} />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* Content Picker Modal */}
      <Modal
        isOpen={isContentPickerOpen}
        onClose={() => setIsContentPickerOpen(false)}
        title={`Select ${
          contentPickerType === "scorm" ? "SCORM Module" : "Form"
        }`}
      >
        {isLoadingContent ? (
          <div className="py-8 text-center text-gray-500">
            Loading content...
          </div>
        ) : contentOptions.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No available content found.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
            {filteredContentOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedContentId === opt.id
                    ? "border-secondary bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="content-option"
                  value={opt.id}
                  checked={selectedContentId === opt.id}
                  onChange={() => setSelectedContentId(opt.id)}
                  className="text-secondary focus:ring-secondary h-4 w-4"
                />
                <span className="text-sm text-gray-700 font-medium">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={() => setIsContentPickerOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={applySelectedContent}
            disabled={!selectedContentId}
            className="px-4 py-2 text-sm font-semibold text-white bg-secondary rounded-lg hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ManageCourse;
