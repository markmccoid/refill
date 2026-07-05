import { Sidebar } from "@/components/Sidebar";
import { AuthGate } from "@/components/AuthGate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-bg p-8">
        <div className="bg-surface border border-border-strong rounded-lg overflow-hidden flex h-[calc(100vh-64px)]">
          <Sidebar />
          <main className="flex-1 overflow-auto px-10 py-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
