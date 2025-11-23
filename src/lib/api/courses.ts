import { supabase } from '../../../lib/supabaseClient';

export type CourseItemType = "scorm" | "form" | "competency" | "workshop";

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
