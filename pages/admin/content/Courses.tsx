import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FavoritesSection from '../../../components/FavoritesSection';
import { createCourse, listCourses, CompletionRule, Course } from '../../../src/lib/api/courses';

// --- Reusable Components ---

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
  React.useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const baseClasses = "fixed top-20 right-5 z-[100] px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
  const typeClasses = type === 'error' ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      {message}
    </div>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6" aria-modal="true" role="dialog">
      <div className="w-full max-w-2xl transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col">
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light" aria-label="Close modal">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

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

// --- Create Course Form Component ---

interface CreateCourseFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export const CreateCourseForm: React.FC<CreateCourseFormProps> = ({ onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [completionRule, setCompletionRule] = useState<CompletionRule>('all');
  const [completionRequiredNumber, setCompletionRequiredNumber] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Course title is required.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const reqNum = completionRule === 'any_x_of_y' && completionRequiredNumber 
        ? parseInt(completionRequiredNumber, 10) 
        : null;

      if (completionRule === 'any_x_of_y' && (!reqNum || reqNum < 1)) {
         throw new Error("Please enter a valid required number (must be 1 or greater).");
      }

      await createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        completionRule,
        completionRequiredNumber: reqNum,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      setCompletionRule('all');
      setCompletionRequiredNumber('');
      
      onSuccess();

    } catch (err: any) {
      console.error("Failed to create course:", err);
      setError(err.message || 'Failed to create course.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary outline-none shadow-sm"
              placeholder="e.g. New Employee Onboarding"
              disabled={isCreating}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary outline-none shadow-sm resize-none"
              placeholder="Short summary of what this course covers..."
              disabled={isCreating}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary outline-none shadow-sm"
              placeholder="e.g. Compliance, HR, Safety"
              disabled={isCreating}
            />
          </div>

          {/* Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="completionRule" className="block text-sm font-medium text-gray-700 mb-1">
                Completion Rule
              </label>
              <select
                id="completionRule"
                value={completionRule}
                onChange={(e) => setCompletionRule(e.target.value as CompletionRule)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary outline-none shadow-sm"
                disabled={isCreating}
              >
                <option value="all">All items required</option>
                <option value="sequence">Sequential order</option>
                <option value="any_x_of_y">Any X items</option>
              </select>
            </div>

            <div>
              <label 
                htmlFor="completionRequiredNumber" 
                className={`block text-sm font-medium mb-1 ${completionRule === 'any_x_of_y' ? 'text-gray-700' : 'text-gray-400'}`}
              >
                Required Number
              </label>
              <input
                id="completionRequiredNumber"
                type="number"
                min="1"
                value={completionRequiredNumber}
                onChange={(e) => setCompletionRequiredNumber(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary outline-none shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
                placeholder={completionRule === 'any_x_of_y' ? "e.g. 3" : "N/A"}
                disabled={isCreating || completionRule !== 'any_x_of_y'}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCreating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="inline-flex justify-center rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isCreating ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
    </div>
  );
};

// --- Main AdminCourses Page ---

const AdminCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadCourses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCourses();
      setCourses(data);
    } catch (err: any) {
      console.error("Error loading courses:", err);
      setError("Failed to load courses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreateSuccess = () => {
      setIsCreateModalOpen(false);
      setToast({ message: "Course created successfully!", type: "success" });
      loadCourses();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
            <Link to="/admin/content" className="text-sm text-blue-600 hover:underline">&larr; Back to Content Management</Link>
            <h1 className="text-3xl font-bold text-primary mt-2">Manage Courses</h1>
            <p className="mt-1 text-gray-600">Create and manage course curricula.</p>
        </div>
        <div>
            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center justify-center rounded-xl bg-[#153AC7] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(21,58,199,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2da0] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#153AC7]"
            >
                <span className="mr-2 font-bold">+</span> Create Course
            </button>
        </div>
      </div>

      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">All Courses</h2>
        
        {isLoading ? (
            <p className="text-gray-500 text-center py-4">Loading courses…</p>
        ) : error ? (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm text-center">
                {error}
                <button onClick={loadCourses} className="ml-2 underline font-semibold">Retry</button>
            </div>
        ) : courses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <p className="text-gray-500 mb-2">No courses have been created yet.</p>
                <button onClick={() => setIsCreateModalOpen(true)} className="text-secondary font-medium hover:underline">Create your first course</button>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b bg-gray-50">
                        <tr>
                            <th className="py-3 pl-4 pr-4 font-semibold text-gray-700">Title</th>
                            <th className="py-3 pr-4 font-semibold text-gray-700">Category</th>
                            <th className="py-3 pr-4 font-semibold text-gray-700">Completion Rule</th>
                            <th className="py-3 pr-4 font-semibold text-gray-700">Created At</th>
                            <th className="py-3 pl-4 font-semibold text-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {courses.map((course) => (
                            <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 pl-4 pr-4 font-medium text-gray-800">{course.title}</td>
                                <td className="py-3 pr-4 text-gray-600">{course.category || '—'}</td>
                                <td className="py-3 pr-4 text-gray-600">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                        {formatCompletionRule(course.completion_rule, course.completion_required_number)}
                                    </span>
                                </td>
                                <td className="py-3 pr-4 text-gray-600">{formatDate(course.created_at)}</td>
                                <td className="py-3 pl-4 text-right pr-4">
                                    <Link
                                        to={`/admin/content/courses/${course.id}`}
                                        className="text-gray-400 hover:text-secondary font-medium text-xs border border-gray-200 rounded px-2 py-1 hover:border-secondary transition-colors inline-block"
                                    >
                                        Manage
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Course"
      >
        <CreateCourseForm 
            onSuccess={handleCreateSuccess} 
            onCancel={() => setIsCreateModalOpen(false)} 
        />
      </Modal>
    </div>
  );
};

export default AdminCourses;