import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { Course } from '../../../src/lib/api/courses';

const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
};

const formatCompletionRule = (rule: string, requiredNum: number | null) => {
    switch (rule) {
        case 'all': return 'All items required';
        case 'sequence': return 'Sequential order';
        case 'any_x_of_y': return `Any ${requiredNum ?? 'X'} items`;
        default: return rule;
    }
};

const ManageCourse: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading course...</div>;
  }

  if (error || !course) {
    return (
        <div className="p-8 text-center animate-fade-in">
            <p className="text-red-600 mb-4">{error || "Course not found."}</p>
            <Link to="/admin/content/courses" className="text-secondary hover:underline">&larr; Back to Courses</Link>
        </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/admin/content/courses" className="text-sm text-blue-600 hover:underline">&larr; Back to Courses</Link>
        <h1 className="text-3xl font-bold text-primary mt-2">Manage Course</h1>
        <p className="mt-1 text-gray-600 font-medium">{course.title}</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Course Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
                <span className="block text-gray-500 mb-1">Title</span>
                <span className="font-medium text-gray-900 text-base">{course.title}</span>
            </div>
            <div>
                <span className="block text-gray-500 mb-1">Category</span>
                <span className="font-medium text-gray-900">{course.category || '—'}</span>
            </div>
            <div>
                <span className="block text-gray-500 mb-1">Completion Rule</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {formatCompletionRule(course.completion_rule, course.completion_required_number)}
                </span>
            </div>
            <div>
                <span className="block text-gray-500 mb-1">Created At</span>
                <span className="font-medium text-gray-900">{formatDate(course.created_at)}</span>
            </div>
             <div className="md:col-span-2">
                <span className="block text-gray-500 mb-1">Description</span>
                <span className="font-medium text-gray-900 whitespace-pre-wrap">{course.description || <span className="text-gray-400 italic">No description provided.</span>}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManageCourse;