import { Sidebar } from '@/components/layout/Sidebar';
import { SocketProvider } from '@/components/layout/SocketProvider';
import { CopilotDrawer } from '@/components/layout/CopilotDrawer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <CopilotDrawer />
      </div>
    </SocketProvider>
  );
}
