import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#09090a] text-zinc-50">
      <Outlet />
    </div>
  );
}
