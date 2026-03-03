import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Home, Calendar, Star, BookOpen, Bell, MessageSquare,
  User, Settings, LogOut, Sun, Moon, ShieldCheck, GraduationCap,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/schedule", label: "Расписание", icon: Calendar },
  { to: "/grades", label: "Оценки", icon: Star },
  { to: "/homework", label: "Задания", icon: BookOpen },
  { to: "/notifications", label: "Уведомления", icon: Bell },
  { to: "/chat", label: "Сообщения", icon: MessageSquare },
];

const colorPresets = [
  { name: "Индиго", value: "hsl(234, 62%, 46%)" },
  { name: "Изумруд", value: "hsl(152, 60%, 32%)" },
  { name: "Рубин", value: "hsl(0, 72%, 40%)" },
  { name: "Аметист", value: "hsl(270, 50%, 45%)" },
  { name: "Янтарь", value: "hsl(38, 92%, 40%)" },
  { name: "Океан", value: "hsl(200, 70%, 40%)" },
  { name: "Графит", value: "hsl(220, 20%, 25%)" },
  { name: "Полночь", value: "hsl(224, 40%, 12%)" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [sidebarColor, setSidebarColor] = useState("");
  const [sidebarImage, setSidebarImage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const profileSnap = await getDoc(doc(db, "users", user.id));
        if (profileSnap.exists()) {
          const p = profileSnap.data();
          setIsAdmin(p.role === "admin");
          setIsTeacher(p.role === "teacher");
          setAvatarUrl(p.avatar_url || "");
          setSidebarColor(p.sidebar_color || "");
          setSidebarImage(p.sidebar_image || "");
          setDisplayName(p.full_name || user.displayName || "");
        }
      } catch {
        // ignore errors
      }
    };

    loadProfile();
  }, [user]);

  // Счётчик непрочитанных уведомлений в реальном времени
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const notifQ = query(
      collection(db, "notifications"),
      where("user_id", "==", uid),
      where("is_read", "==", false)
    );
    const unsub = onSnapshot(notifQ, (snap) => setUnreadCount(snap.size));
    return unsub;
  }, [user?.id]);

  const saveSidebarSettings = async (color: string, image: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.id), {
        sidebar_color: color,
        sidebar_image: image,
      });
      setSidebarColor(color);
      setSidebarImage(image);
      toast.success("Сайдбар обновлён");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadToCloudinary(file);
      await saveSidebarSettings("", url);
      setSettingsOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const sidebarStyle: React.CSSProperties = sidebarImage
    ? { backgroundImage: `url(${sidebarImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : sidebarColor
    ? { backgroundColor: sidebarColor }
    : {};

  const linkClass = (path: string) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
      location.pathname === path
        ? "bg-white/20 text-white backdrop-blur-sm"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    );

  return (
    <aside
      className="hidden md:flex flex-col w-64 lg:w-72 bg-primary min-h-screen p-4 text-primary-foreground glass-sidebar relative flex-shrink-0"
      style={sidebarStyle}
    >
      {sidebarImage && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start gap-2 px-3 py-4 mb-6">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/20 backdrop-blur-sm flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-base leading-tight truncate" title="PortalCheresh">PortalCheresh</h1>
            <p className="text-xs opacity-70">Личный кабинет</p>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/80 hover:text-white flex-shrink-0 mt-0.5"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={linkClass(item.to)}>
                <Icon size={18} className="flex-shrink-0" />
                {item.label}
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
          {isTeacher && (
            <NavLink to="/teacher" className={linkClass("/teacher")}>
              <GraduationCap size={18} className="flex-shrink-0" />
              Преподаватель
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass("/admin")}>
              <ShieldCheck size={18} className="flex-shrink-0" />
              Админ-панель
            </NavLink>
          )}
        </nav>

        <div className="border-t border-white/20 pt-4 mt-4 space-y-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Settings size={16} />
            Настроить панель
          </button>
          <NavLink to="/profile" className={linkClass("/profile")}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{displayName?.charAt(0) || "?"}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName || "Профиль"}</p>
              <p className="text-xs opacity-60 truncate">{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Настройка панели</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Цвет фона</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {colorPresets.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { saveSidebarSettings(c.value, ""); setSettingsOpen(false); }}
                    className="h-10 rounded-lg border-2 border-transparent hover:border-ring transition-colors relative group"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Или загрузите изображение</Label>
              <Button variant="outline" className="w-full mt-2" onClick={() => fileInput.current?.click()}>
                Выбрать изображение
              </Button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => { saveSidebarSettings("", ""); setSettingsOpen(false); }}
            >
              Сбросить к стандартному
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
};

export default AppSidebar;
