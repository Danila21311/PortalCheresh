import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Home, Calendar, Star, BookOpen, Bell, MessageSquare, User, Sun, Moon } from "lucide-react";

const navItems = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/schedule", label: "Расписание", icon: Calendar },
  { to: "/grades", label: "Оценки", icon: Star },
  { to: "/homework", label: "Задания", icon: BookOpen },
  { to: "/notifications", label: "Уведомления", icon: Bell },
  { to: "/chat", label: "Сообщения", icon: MessageSquare },
  { to: "/profile", label: "Профиль", icon: User },
];

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  // Счётчик непрочитанных в реальном времени
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", uid),
      where("is_read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return unsub;
  }, [user?.id]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50 safe-area-pb">
      <div className="flex items-center justify-between gap-0.5 min-w-0 px-1 sm:px-2 py-1.5 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-1.5 px-0.5 sm:px-2 rounded-lg text-xs transition-colors min-w-0 flex-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-all flex-shrink-0",
                isActive && "bg-primary/10"
              )}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} className="sm:w-5 sm:h-5" />
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[9px] sm:text-[10px] leading-tight text-center truncate w-full", isActive && "font-semibold")}>{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-0.5 py-1.5 px-0.5 sm:px-2 rounded-lg text-xs text-muted-foreground transition-colors min-w-0 flex-1"
        >
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex-shrink-0">
            {theme === "dark" ? <Sun size={18} strokeWidth={1.8} className="sm:w-5 sm:h-5" /> : <Moon size={18} strokeWidth={1.8} className="sm:w-5 sm:h-5" />}
          </div>
          <span className="text-[9px] sm:text-[10px] leading-tight">{theme === "dark" ? "Светлая" : "Тёмная"}</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileNav;
