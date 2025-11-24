import { supabase } from '../../../lib/supabaseClient';

export type CourseItemType = "scorm" | "form" | "competency" | "workshop" | "assignment";

export interface AddCourseItemParams {
  courseId: string;
  itemType: CourseItemType;
  itemId: string;
  isRequired?: boolean;
}

export async function addCourseItem({
  courseId,
  itemType,
  itemId,
  isRequired = true,
}: AddCourseItemParams) {
  const { data, error } = await supabase.functions.invoke(
    "add-course-item",
    {
      body: {
        course_id: courseId,
        item_type: itemType,
        item_id: itemId,
        is_required: isRequired,
      },
    },
  );

  if (error) {
    console.error("add-course-item error", error);
    throw error;
  }

  return data;
}

export type CompletionRule = "all" | "sequence" | "any_x_of_y";

export interface CreateCourseParams {
  title: string;
  description?: string;
  category?: string;
  completionRule?: CompletionRule;
  completionRequiredNumber?: number | null;
}

export async function createCourse({
  title,
  description,
  category,
  completionRule = "all",
  completionRequiredNumber = null,
}: CreateCourseParams) {
  const { data, error } = await supabase.functions.invoke(
    "create-course",
    {
      body: {
        title,
        description,
        category,
        completion_rule: completionRule,
        completion_required_number: completionRequiredNumber,
      },
    },
  );

  if (error) {
    console.error("create-course error", error);
    throw error;
  }

  return data;
}

export interface Course {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  category: string | null;
  completion_rule: "all" | "sequence" | "any_x_of_y";
  completion_required_number: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, code, title, description, category, completion_rule, completion_required_number, is_active, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCourses error", error);
    throw error;
  }

  return (data ?? []) as Course[];
}

export type CourseItemRecord = {
  id: string;
  course_id: string;
  item_type: "scorm" | "form" | "competency" | "workshop" | "assignment";
  item_id: string;
  sort_index: number | null;
  is_required: boolean | null;
  created_at: string;
};

export async function listCourseItemsForCourse(
  courseId: string,
): Promise<CourseItemRecord[]> {
  const { data, error } = await supabase
    .from("course_items")
    .select(
      "id, course_id, item_type, item_id, sort_index, is_required, created_at",
    )
    .eq("course_id", courseId)
    .order("sort_index", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listCourseItemsForCourse error", error);
    throw error;
  }

  return (data ?? []) as CourseItemRecord[];
}

export interface CourseItemInput {
  id?: string;          // optional (ignored for now)
  item_type: "scorm" | "form" | "competency" | "workshop" | "assignment";
  item_id: string | null;   // null for now, we will wire this later
  is_required: boolean | null;
}

export async function saveCourseItemsForCourse(
  courseId: string,
  items: CourseItemInput[],
): Promise<void> {
  // 1) delete existing items for the course
  const { error: deleteError } = await supabase
    .from("course_items")
    .delete()
    .eq("course_id", courseId);

  if (deleteError) {
    console.error("saveCourseItemsForCourse delete error", deleteError);
    throw deleteError;
  }

  if (items.length === 0) {
    return;
  }

  // 2) insert fresh rows with correct sort_index
  const payload = items.map((item, index) => ({
    course_id: courseId,
    item_type: item.item_type,
    item_id: item.item_id,
    is_required: item.is_required,
    sort_index: index,
  }));

  const { error: insertError } = await supabase
    .from("course_items")
    .insert(payload);

  if (insertError) {
    console.error("saveCourseItemsForCourse insert error", insertError);
    throw insertError;
  }
}