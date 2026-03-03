import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Home, Calendar, BookOpen, Bell, User, Sun, Moon } from "lucide-react";

const navItems = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/schedule", label: "Расписание", icon: Calendar },
  { to: "/homework", label: "Задания", icon: BookOpen },
  { to: "/notifications", label: "Уведомления", icon: Bell },
  { to: "/profile", label: "Профиль", icon: User },
];

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.id),
      where("is_read", "==", false)
    );
    getDocs(q).then(snap => setUnreadCount(snap.size)).catch(() => {});
  }, [user]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50">
      <div className="flex items-center justify-around px-2 py-1 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs transition-colors min-w-[52px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-xl transition-all",
                isActive && "bg-primary/10"
              )}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px]", isActive && "font-semibold")}>{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs text-muted-foreground transition-colors min-w-[52px]"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl">
            {theme === "dark" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          </div>
          <span className="text-[10px]">{theme === "dark" ? "Светлая" : "Тёмная"}</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileNav;
