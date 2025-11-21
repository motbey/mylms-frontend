import { useEffect } from "react";
import { Link } from "react-router-dom";
import FavoritesSection from "../../components/FavoritesSection";

export default function NotificationsPage() {
  useEffect(() => {
    document.title = "Admin · Notifications | MyLMS";
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Link to="/admin" className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50">
          ← Back to Admin
        </Link>
      </div>
      
      <FavoritesSection />

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm opacity-80">
          Configure email templates, schedules, and rules here. We’ll build functionality next.
        </p>
      </div>
    </div>
  );
}
