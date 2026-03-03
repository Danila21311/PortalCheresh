import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";

const Layout = () => {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <AppSidebar />
      <main className="flex-1 min-w-0 min-h-0 w-0 p-4 sm:p-5 md:p-6 lg:p-8 pb-20 md:pb-8 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
};

export default Layout;
