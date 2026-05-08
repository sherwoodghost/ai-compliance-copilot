import { Sidebar } from '@/components/layout/Sidebar';
import { SocketProvider } from '@/components/layout/SocketProvider';
import { CopilotDrawer } from '@/components/layout/CopilotDrawer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        {/* On mobile, sidebar is a fixed overlay so main takes full width.
            pt-14 on mobile gives clearance for the floating hamburger button. */}
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          {children}
        </main>
        <CopilotDrawer />
      </div>
    </SocketProvider>
  );
}
