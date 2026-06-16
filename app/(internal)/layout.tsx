import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { TrialBanner } from "@/components/TrialBanner";

// Layout for internt klinikker-/staff-UI (PraxisOS-chrome).
// Tenant-frontends under /t/[slug] arver IKKE dette — de har eget brand-layout.
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-grain">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-7 py-7 lg:px-10">
            <TrialBanner slug="bypilar" />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
