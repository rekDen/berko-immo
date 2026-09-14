import Sidebar from "@/components/Sidebar";
import EmailNotificationsProvider from "@/components/EmailNotifications";
import UsageTracker from "@/components/UsageTracker";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmailNotificationsProvider>
      <UsageTracker />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </EmailNotificationsProvider>
  );
}
