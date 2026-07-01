import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="bg-surface border border-black/10 rounded-lg overflow-hidden flex h-[calc(100vh-64px)]">
        <Sidebar />
        <main className="flex-1 overflow-auto px-10 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
