import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "../pages/Home";
import Login from "../pages/Login";
import SignUp from "../pages/SignUp";
import AdminLogin from "../pages/admin/Login";
import Dashboard from "../pages/dashboard/Dashboard";
// FIX: Import `UserForms` and `UserFillForm` as named exports.
import { UserForms, UserFillForm } from "../pages/user/Forms";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/Users";
import AdminGroups from "../pages/admin/Groups";
import AdminPrivileges from "../pages/admin/Privileges";
import AdminContentDashboard from "../pages/admin/ContentDashboard";
import AdminElearning from "../pages/admin/content/Elearning";
import UploadScormToS3 from "../pages/admin/content/UploadScormToS3";
import AdminCompetencies from "../pages/admin/content/Competencies";
import AssignCompetencies from "../pages/admin/content/AssignCompetencies";
import UserCompetencies from "../pages/admin/content/UserCompetencies";
import AdminCourses from "../pages/admin/content/Courses";
import ManageCourse from "../pages/admin/content/ManageCourse";
import AdminWorkshops from "../pages/admin/content/Workshops";
import WorkshopSessionsPage from "../pages/admin/content/WorkshopSessions";
import AdminForms from "../pages/admin/content/Forms";
import CreateFormPage from "../pages/admin/content/forms/Create";
import {
  AdminFormSubmissionsListPage,
  AdminFormSubmissionReviewPage,
} from "../pages/admin/content/forms/Submissions";
import AdminReports from "../pages/admin/Reports";
import AdminSettings from "../pages/admin/Settings";
import AdminIntegrations from "../pages/admin/settings/Integrations";
import NotificationsPage from "../pages/admin/NotificationsPage";
import ScormPlayer from "../pages/scorm/Player";

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/forms" element={<UserForms />} />
          <Route path="/forms/:formId/fill" element={<UserFillForm />} />
          <Route path="/scorm/:id" element={<ScormPlayer />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/groups" element={<AdminGroups />} />
          <Route path="/admin/privileges" element={<AdminPrivileges />} />
          <Route path="/admin/content" element={<AdminContentDashboard />} />
          <Route path="/admin/content/elearning" element={<AdminElearning />} />
          <Route
            path="/admin/content/upload-scorm-s3"
            element={<UploadScormToS3 />}
          />
          <Route
            path="/admin/content/competencies"
            element={<AdminCompetencies />}
          />
          <Route
            path="/admin/content/competencies/assign"
            element={<AssignCompetencies />}
          />
          <Route
            path="/admin/content/competencies/assign/:userId"
            element={<UserCompetencies />}
          />
          <Route path="/admin/content/courses" element={<AdminCourses />} />
          <Route
            path="/admin/content/courses/:courseId"
            element={<ManageCourse />}
          />
          <Route path="/admin/content/workshops" element={<AdminWorkshops />} />
          <Route
            path="/admin/content/workshops/:workshopId/sessions"
            element={<WorkshopSessionsPage />}
          />
          <Route path="/admin/content/forms" element={<AdminForms />} />
          <Route
            path="/admin/content/forms/create"
            element={<CreateFormPage />}
          />
          <Route
            path="/admin/content/forms/:formId"
            element={<CreateFormPage />}
          />
          <Route
            path="/admin/forms/submissions"
            element={<AdminFormSubmissionsListPage />}
          />
          <Route
            path="/admin/forms/submissions/:submissionId"
            element={<AdminFormSubmissionReviewPage />}
          />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route
            path="/admin/settings/integrations"
            element={<AdminIntegrations />}
          />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
