import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy,
  onSnapshot, updateDoc, deleteDoc, doc, writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Notification } from "@/types";

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const openChatFromNotification = (n: Notification) => {
    if (n.type !== "message") return;
    if (!n.sender_id && !n.conversation_id) return;
    if (!n.is_read) markAsRead(n.id);
    if (n.sender_id) {
      navigate(`/chat?userId=${n.sender_id}`);
    } else {
      navigate(`/chat?conversationId=${n.conversation_id}`);
    }
  };

  // Подписка в реальном времени — новые уведомления появляются без перезагрузки
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", uid),
      orderBy("created_at", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    }, (err) => {
      console.error("Notifications listener error:", err);
      setLoading(false);
    });

    return unsub;
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await updateDoc(doc(db, "notifications", id), { is_read: true });
    } catch (err: any) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      toast.error(err.message);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );
    try {
      const batch = writeBatch(db);
      unread.forEach((n) =>
        batch.update(doc(db, "notifications", n.id), { is_read: true })
      );
      await batch.commit();
      toast.success("Все уведомления отмечены как прочитанные");
    } catch (err: any) {
      setNotifications((prev) =>
        prev.map((n) => (unread.some((u) => u.id === n.id) ? { ...n, is_read: false } : n))
      );
      toast.error(err.message);
    }
  };

  const deleteNotif = async (id: string) => {
    const removed = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err: any) {
      if (removed) setNotifications((prev) => [...prev, removed].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
      toast.error(err.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const typeStyle = (type: string) => {
    switch (type) {
      case "grade": return "border-l-4 border-l-success";
      case "homework": return "border-l-4 border-l-accent";
      case "message": return "border-l-4 border-l-primary";
      default: return "border-l-4 border-l-muted";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Уведомления</h1>
          {unreadCount > 0 && <p className="text-sm text-muted-foreground mt-1">{unreadCount} непрочитанных</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Прочитать все
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">Нет уведомлений</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "glass-card rounded-xl p-4 flex items-start gap-3 transition-opacity",
                !n.is_read && "bg-primary/5",
                typeStyle(n.type),
                n.type === "message" && (n.sender_id || n.conversation_id) && "cursor-pointer hover:bg-muted/50"
              )}
              onClick={() => openChatFromNotification(n)}
              role={n.type === "message" && (n.sender_id || n.conversation_id) ? "button" : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("font-medium text-sm", !n.is_read && "font-semibold")}>{n.title}</p>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </div>
                {n.message && <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {!n.is_read && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAsRead(n.id)}>
                    Прочитано
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => deleteNotif(n.id)}>
                  ✕
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
