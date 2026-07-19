import { Sidebar } from "@/components/Sidebar";
import { AuthGate } from "@/components/AuthGate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      {/* Fixed app chrome: sidebar rail + scrolling main. Document never scrolls. */}
      <div data-app-shell className="fixed inset-0 flex bg-bg">
        <Sidebar />
        <main className="app-main min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-8 md:pb-10">
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
