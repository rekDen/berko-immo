import Sidebar from "@/components/Sidebar";
import EmailNotificationsProvider from "@/components/EmailNotifications";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmailNotificationsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </EmailNotificationsProvider>
  );
}
