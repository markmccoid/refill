import { Sidebar } from "@/components/Sidebar";
import { AuthGate } from "@/components/AuthGate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-bg p-0 md:p-8">
        <div className="bg-bg border-border-strong overflow-hidden flex min-h-screen md:h-[calc(100vh-64px)] md:rounded-xl md:border">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-auto bg-bg px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-8 md:pb-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
