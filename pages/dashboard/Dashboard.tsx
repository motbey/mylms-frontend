import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { Profile, getMyProfile } from '../../src/lib/profiles';
import RoleSwitcher from '../../src/components/RoleSwitcher';
import { listMyForms, MyForm } from '../../src/services/forms';
import {
  LayoutDashboard,
  BookOpenCheck,
  FileText,
  Award,
  Play,
  Loader,
  Check,
  Circle,
  Send,
  CheckCircle2,
  XCircle,
  CalendarDays,
} from 'lucide-react';

// --- Types ---
type View = 'dashboard' | 'courses' | 'forms' | 'qualifications';
type FormStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected';
type Urgency = 'overdue' | 'due-soon' | 'normal';


// --- Mock Data & Constants ---
const mockCourses = [
  {
    title: 'Advanced Safety Protocols',
    description: 'Master the latest in workplace safety and compliance.',
    status: 'In Progress',
    progress: 75,
    accent: 'accent',
  },
  {
    title: 'Cybersecurity Essentials',
    description: 'Learn to protect digital assets from modern threats.',
    status: 'Not Started',
    progress: 0,
    accent: 'secondary',
  },
  {
    title: 'Leadership & Management',
    description: 'Develop key skills to lead and inspire your teams.',
    status: 'Completed',
    progress: 100,
    accent: 'primary',
  },
  {
    title: 'Customer Service Excellence',
    description: 'Enhance your communication and problem-solving abilities.',
    status: 'In Progress',
    progress: 30,
    accent: 'accent',
  },
];

const mockDeadlines = [
  { name: 'Annual Compliance Training', dueDate: '18 Nov 2025', urgency: 'orange' },
  { name: 'Fire Safety Quiz', dueDate: '25 Nov 2025', urgency: 'blue' },
  { name: 'Workplace Ethics Form', dueDate: '02 Dec 2025', urgency: 'blue' },
  { name: 'First Aid Certification', dueDate: '01 Oct 2025', urgency: 'red' },
];

const accentColors: { [key: string]: { bg: string; text: string; border: string; ribbonBg: string } } = {
  accent: { bg: 'bg-accent', text: 'text-accent', border: 'border-accent', ribbonBg: 'bg-accent' },
  secondary: { bg: 'bg-secondary', text: 'text-secondary', border: 'border-secondary', ribbonBg: 'bg-secondary' },
  primary: { bg: 'bg-primary', text: 'text-primary', border: 'border-primary', ribbonBg: 'bg-primary' },
};

const solidRibbonClasses = ['bg-[#0084ff]', 'bg-[#153ac7]', 'bg-[#030037]'];

const formAccentColors = ['accent', 'secondary', 'primary'];
const formAccentColorClasses: { [key: string]: { ribbonBg: string; border: string; text: string; } } = {
  accent: { ribbonBg: 'bg-accent', border: 'border-accent', text: 'text-accent' },
  secondary: { ribbonBg: 'bg-secondary', border: 'border-secondary', text: 'text-secondary' },
  primary: { ribbonBg: 'bg-primary', border: 'border-primary', text: 'text-primary' },
};

const formStatusConfig: Record<FormStatus, { icon: React.FC<any>; ribbonClass: string; }> = {
  'Not Started': { icon: Circle, ribbonClass: 'bg-gray-400' },
  'In Progress': { icon: Loader, ribbonClass: 'bg-blue-500' },
  'Submitted': { icon: Send, ribbonClass: 'bg-purple-500' },
  'Approved': { icon: CheckCircle2, ribbonClass: 'bg-green-600' },
  'Rejected': { icon: XCircle, ribbonClass: 'bg-red-600' },
};
const filterPills: ('All' | FormStatus)[] = ['All', 'Not Started', 'In Progress', 'Submitted', 'Approved', 'Rejected'];

// --- Helper Functions ---
const mapMyFormStatus = (status: MyForm['status']): FormStatus => {
    switch (status) {
      case 'Started': return 'In Progress';
      case 'Completed': return 'Approved';
      default: return status;
    }
};

const getUrgency = (dueDate: string | null): Urgency | null => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'due-soon';
    return 'normal';
};

// --- Skeleton Component ---
const DashboardSkeleton = () => (
    <div className="animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-64"></div>
        </div>
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
          <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
        </div>
      </div>
      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3"><div className="h-48 bg-gray-200 rounded-xl"></div></div>
        <div className="lg:col-span-6 space-y-8">
            <div className="h-6 bg-gray-300 rounded w-48 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div className="h-56 bg-gray-200 rounded-xl"></div>
                <div className="h-56 bg-gray-200 rounded-xl"></div>
                <div className="h-56 bg-gray-200 rounded-xl"></div>
            </div>
        </div>
        <aside className="lg:col-span-3 space-y-6">
          <div className="h-48 bg-gray-200 rounded-xl"></div>
          <div className="h-56 bg-gray-200 rounded-xl"></div>
        </aside>
      </div>
    </div>
);
  
// --- View Components ---

const FormsSnapshotWidget: React.FC<{ forms: MyForm[]; loading: boolean }> = ({ forms, loading }) => {
    const statusCounts = useMemo(() => {
      const counts = {
        'Not Started': 0,
        'In Progress': 0,
        'Submitted': 0,
        'Approved': 0,
        'Rejected': 0,
      };
      forms.forEach(form => {
        const status = mapMyFormStatus(form.status);
        if (status in counts) {
          counts[status]++;
        }
      });
      return counts;
    }, [forms]);
  
    const totalForms = forms.length;
    const completionPercentage = totalForms > 0 ? Math.round((statusCounts.Approved / totalForms) * 100) : 0;
  
    if (loading) {
      return <div className="bg-white p-5 rounded-xl shadow-sm border animate-pulse h-48"><div className="h-full bg-gray-200 rounded-md"></div></div>;
    }
    
    const statusItems = [
      { label: 'Approved', count: statusCounts.Approved, color: 'text-green-600' },
      { label: 'Submitted', count: statusCounts.Submitted, color: 'text-purple-600' },
      { label: 'In Progress', count: statusCounts['In Progress'], color: 'text-blue-600' },
      { label: 'Not Started', count: statusCounts['Not Started'], color: 'text-gray-500' },
    ];

    return (
      <div className="bg-white p-5 rounded-xl shadow-sm border">
        <h3 className="font-bold text-primary">Forms Overview</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">Your current form statuses</p>
        <div className="grid grid-cols-2 gap-6">
          <ul className="space-y-3">
            {statusItems.map(item => (
              <li key={item.label} className="flex justify-between items-center text-sm">
                <span className={`flex items-center font-medium ${item.color}`}>
                  <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'currentColor' }}></span>
                  {item.label}
                </span>
                <span className="font-bold text-gray-700">{item.count}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-center">
            <div className="relative inline-flex items-center justify-center">
              <div className="h-24 w-24 rounded-full" style={{ background: `conic-gradient(var(--color-secondary) ${completionPercentage}%, #e5e7eb 0)` }}>
                <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{completionPercentage}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};

const CoursesView: React.FC = () => (
    <div>
      <h2 className="text-xl font-bold text-primary">My Courses</h2>
      <p className="text-gray-500 text-sm mt-1">Courses you’re currently working on.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        {mockCourses.map((course, index) => <CourseCard key={index} {...course} index={index} />)}
      </div>
    </div>
);

const FormsView: React.FC<{ forms: MyForm[]; loading: boolean; error: string | null }> = ({ forms, loading, error }) => {
    const [activeFilter, setActiveFilter] = useState<'All' | FormStatus>('All');
  
    const filteredForms = useMemo(() => {
      if (activeFilter === 'All') return forms;
      return forms.filter(form => mapMyFormStatus(form.status) === activeFilter);
    }, [forms, activeFilter]);
  
    const renderContent = () => {
        if (loading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                    {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-200 h-64 rounded-xl"></div>)}
                </div>
            );
        }
        if (error) {
            return <p className="text-red-600 text-center py-8 bg-red-50 rounded-lg">{error}</p>;
        }
        if (filteredForms.length === 0) {
            return <FormsEmptyState />;
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredForms.map((form, index) => <FormCard key={form.assignment_id} form={form} index={index} />)}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-primary">Forms</h2>
                <p className="text-gray-500 text-sm mt-1">Forms and surveys assigned to you.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {filterPills.map(filter => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-full border-2 transition-colors ${
                            activeFilter === filter
                            ? 'bg-secondary text-white border-transparent'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-secondary hover:text-secondary'
                        }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>
            <div>{renderContent()}</div>
        </div>
    );
};

const QualificationsView: React.FC = () => (
    <div>
        <h2 className="text-xl font-bold text-primary">Qualifications</h2>
        <p className="text-gray-500 text-sm mt-1">Your current qualifications and certifications.</p>
        <div className="mt-4 text-center py-16 px-6 bg-gray-50 rounded-2xl border-2 border-dashed">
            <Award className="mx-auto h-12 w-12 text-gray-400" strokeWidth={1} />
            <h3 className="mt-4 text-lg font-semibold text-gray-800">Coming Soon</h3>
            <p className="mt-1 text-sm text-gray-500">This section is under construction.</p>
        </div>
    </div>
);

// --- Sub-components ---

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    view: View;
    activeView: View;
    onClick: (view: View) => void;
  }> = ({ icon, label, view, activeView, onClick }) => (
    <li>
      <button
        onClick={() => onClick(view)}
        className={`w-full flex items-center gap-3 p-2 rounded-md text-sm font-medium transition-colors ${
          activeView === view
            ? 'bg-blue-100 text-secondary'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    </li>
);

const CourseCard: React.FC<typeof mockCourses[0] & { index: number }> = ({ title, description, status, progress, accent, index }) => {
    const colors = accentColors[accent];
    const ribbonClass = solidRibbonClasses[index % solidRibbonClasses.length];
    
    // Determine text color based on ribbon background for contrast
    const isDarkRibbon = ribbonClass !== 'bg-[#0084ff]';
    const textColorClass = isDarkRibbon ? 'text-white' : 'text-black';
  
    const StatusIcon = status === 'Completed' ? Check : status === 'In Progress' ? Loader : Play;
    return (
      <div className="relative overflow-hidden bg-white rounded-xl shadow-sm border h-full flex flex-col transition-shadow hover:shadow-lg">
        <div className={`absolute -top-8 -left-8 w-24 h-16 ${ribbonClass} transform -rotate-45 flex justify-center items-end ${textColorClass} text-[10px] font-bold pb-1 z-10`}>
            <div className="flex items-center gap-1 transform rotate-45 translate-y-3 -translate-x-1">
              <StatusIcon size={12} className={status === 'In Progress' ? 'animate-spin' : ''} />
              <span>{status}</span>
            </div>
        </div>
        <div className="p-5 flex-grow flex flex-col">
          <h3 className="font-bold text-primary mb-1 mt-4">{title}</h3>
          <p className="text-sm text-gray-500 flex-grow">{description}</p>
          <div className="mt-4"><Link to="#" className={`px-4 py-2 text-sm font-semibold rounded-lg border-2 ${colors.border} ${colors.text} hover:bg-gray-50`}>Continue</Link></div>
        </div>
        <div className="bg-gray-200 h-1.5 w-full"><div className={`${colors.bg} h-full`} style={{ width: `${progress}%` }}></div></div>
      </div>
    );
};

const FormCard: React.FC<{ form: MyForm; index: number }> = ({ form, index }) => {
    const displayStatus = mapMyFormStatus(form.status);
    const StatusIcon = formStatusConfig[displayStatus].icon;
    const accentKey = formAccentColors[index % formAccentColors.length];
    const colors = formAccentColorClasses[accentKey];
  
    return (
      <div className="relative overflow-hidden bg-white rounded-xl shadow-sm border h-full flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
        <div className={`absolute -top-8 -left-8 w-32 h-16 ${colors.ribbonBg} transform -rotate-45 flex justify-center items-end text-white text-[10px] font-bold pb-1 z-10 shadow-inner`}>
          <div className="flex items-center gap-1.5 transform rotate-45 translate-y-3 -translate-x-2">
            <StatusIcon size={12} className={displayStatus === 'In Progress' ? 'animate-spin' : ''} />
            <span>{displayStatus}</span>
          </div>
        </div>
        <div className="p-5 flex-grow flex flex-col">
          <h3 className="font-bold text-primary mb-2 mt-4 text-base">{form.form_name}</h3>
          <p className="text-sm text-gray-500 flex-grow mb-4">Complete this form to provide required information.</p>
          <div className="space-y-3 mb-4"><DueDateBadge dueDate={form.due_at} />{form.submitted_at && <p className="text-xs text-gray-400">Submitted on {new Date(form.submitted_at).toLocaleDateString()}</p>}</div>
          <div className="mt-auto"><Link to={`/forms/${form.form_id}/fill`} className={`inline-block w-full text-center px-4 py-2 text-sm font-semibold rounded-lg border-2 ${colors.border} ${colors.text} bg-white hover:bg-gray-50 transition-colors`}>{['Not Started', 'Started', 'Rejected'].includes(form.status) ? 'Open Form' : 'View Form'}</Link></div>
        </div>
      </div>
    );
};

const DueDateBadge: React.FC<{ dueDate: string | null }> = ({ dueDate }) => {
    const urgency = getUrgency(dueDate);
    if (!urgency || !dueDate) return null;
    const urgencyStyles: Record<Urgency, string> = { overdue: 'bg-red-100 text-red-700', 'due-soon': 'bg-orange-100 text-orange-700', normal: 'bg-gray-100 text-gray-700' };
    const formattedDate = new Date(dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    return <div className={`inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full ${urgencyStyles[urgency]}`}><CalendarDays size={14} /><span>Due {formattedDate}</span></div>;
};

const FormsEmptyState: React.FC = () => (
    <div className="text-center py-16 px-6 bg-gray-50 rounded-2xl border-2 border-dashed">
        <FileText className="mx-auto h-12 w-12 text-gray-400" strokeWidth={1} />
        <h3 className="mt-4 text-lg font-semibold text-gray-800">No forms to display</h3>
        <p className="mt-1 text-sm text-gray-500">You don’t have any forms that match the current filter.</p>
    </div>
);

const CompletionWidget: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
    <h3 className="font-bold text-primary mb-4">Overall completion</h3>
    <div className="relative inline-flex items-center justify-center">
      <div className="h-28 w-28 rounded-full" style={{ background: `conic-gradient(var(--color-secondary) 60%, #e5e7eb 0)`}}><div className="absolute inset-2 bg-white rounded-full flex items-center justify-center"><span className="text-3xl font-bold text-primary">60%</span></div></div>
    </div>
    <p className="text-sm text-gray-500 mt-3">of your assigned learning is completed</p>
  </div>
);

const DeadlinesWidget: React.FC = () => {
    const urgencyColors: { [key: string]: string } = { red: 'bg-red-500', orange: 'bg-orange-400', blue: 'bg-blue-500' };
    return (
        <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="font-bold text-primary mb-4">Upcoming deadlines</h3>
            <ul className="space-y-3">{mockDeadlines.map((item, index) => <li key={index} className="flex items-center gap-3 text-sm"><span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${urgencyColors[item.urgency]}`}></span><span className="flex-grow text-gray-700">{item.name}</span><span className="text-gray-500 font-medium whitespace-nowrap">Due {item.dueDate}</span></li>)}</ul>
        </div>
    );
};

// --- Main Dashboard Component ---
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('dashboard');

  const [forms, setForms] = useState<MyForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetchProfile = async () => {
      setLoading(true);
      setError(null);
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        navigate('/login', { replace: true });
        return;
      }
      setUser(sessionUser);

      try {
        const userProfile = await getMyProfile();
        if (!userProfile) {
          throw new Error("Profile not found.");
        }
        setProfile(userProfile);
      } catch (e: any) {
        console.error("Dashboard profile fetch error:", e);
        setError("Could not load your profile. Please try again later.");
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    checkAuthAndFetchProfile();
  }, [navigate]);

  useEffect(() => {
    // Fetch forms once user profile is available for the dashboard widget
    if (profile && forms.length === 0) { 
      const fetchForms = async () => {
        setFormsLoading(true);
        setFormsError(null);
        try {
          const myForms = await listMyForms();
          setForms(myForms);
        } catch (err: any) {
          console.error("Failed to load my forms:", err);
          setFormsError('We couldn’t load your forms. Please refresh the page or try again later.');
        } finally {
          setFormsLoading(false);
        }
      };
      fetchForms();
    }
  }, [profile, forms.length]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="text-center p-8 bg-red-50 text-red-700 rounded-lg">{error}</div>;

  const userName = (profile?.first_name && profile?.last_name) ? `${profile.first_name} ${profile.last_name}` : profile?.first_name || user?.email || 'User';

  return (
    <div className="animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-gray-500 font-medium">Dashboard</p>
          <h1 className="text-3xl font-bold text-gray-800">Welcome back, {userName}</h1>
          <p className="text-gray-500 mt-1">Here’s what’s happening with your learning.</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
            {profile && <RoleSwitcher currentRole={profile.role as 'admin' | 'user'} roles={profile.roles ?? []} />}
            <button onClick={handleSignOut} className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg border border-gray-300 transition duration-200">Sign Out</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <aside className="lg:col-span-3 order-1">
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-sm border p-4 sticky top-24">
            <h2 className="font-bold text-primary mb-4 px-2">Navigation</h2>
            <nav>
              <ul className="space-y-1">
                <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" view="dashboard" activeView={activeView} onClick={setActiveView} />
                <NavItem icon={<BookOpenCheck size={20} />} label="Courses" view="courses" activeView={activeView} onClick={setActiveView} />
                <NavItem icon={<FileText size={20} />} label="Forms" view="forms" activeView={activeView} onClick={setActiveView} />
                <NavItem icon={<Award size={20} />} label="Qualifications" view="qualifications" activeView={activeView} onClick={setActiveView} />
              </ul>
            </nav>
          </div>
        </aside>

        <main className="lg:col-span-6 order-2">
            {activeView === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <FormsSnapshotWidget forms={forms} loading={formsLoading} />
                {/* Future widgets can be added here */}
              </div>
            )}
            {activeView === 'courses' && <CoursesView />}
            {activeView === 'forms' && <FormsView forms={forms} loading={formsLoading} error={formsError} />}
            {activeView === 'qualifications' && <QualificationsView />}
        </main>

        <aside className="lg:col-span-3 order-3 space-y-6">
          <div className="sticky top-24 space-y-6">
            <CompletionWidget />
            <DeadlinesWidget />
          </div>
        </aside>
      </div>
    </div>
  );
}
