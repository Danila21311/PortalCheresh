import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where,
  addDoc, onSnapshot, updateDoc, doc, getDoc, setDoc, serverTimestamp, deleteField,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Search, Pencil, ImageIcon, ArrowLeft } from "lucide-react";
import type { Message } from "@/types";
import type { GroupConversation } from "@/types";

interface Contact {
  user_id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
}

type SelectedConversation =
  | { type: "direct"; contact: Contact }
  | { type: "group"; group: GroupConversation }
  | null;

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<SelectedConversation>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupImageUrl, setEditGroupImageUrl] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [uploadingGroupImage, setUploadingGroupImage] = useState(false);
  const [selectedIdsToAdd, setSelectedIdsToAdd] = useState<Set<string>>(new Set());
  const [chatThemes, setChatThemes] = useState<Record<string, { chat_bg_color: string; chat_bg_image: string }>>({});
  const [editChatBgColor, setEditChatBgColor] = useState("");
  const [editChatBgImage, setEditChatBgImage] = useState("");
  const [chatBgOpen, setChatBgOpen] = useState(false);
  const [savingChatBg, setSavingChatBg] = useState(false);
  const [contactLastSeen, setContactLastSeen] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const chatBgImageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatBgPresets = [
    { name: "Светлый", value: "hsl(220, 20%, 97%)", isGradient: false },
    { name: "Белый", value: "hsl(0, 0%, 100%)", isGradient: false },
    { name: "Серый", value: "hsl(220, 10%, 92%)", isGradient: false },
    { name: "Голубой", value: "hsl(200, 40%, 95%)", isGradient: false },
    { name: "Лаванда", value: "hsl(260, 30%, 95%)", isGradient: false },
    { name: "Мята", value: "hsl(160, 25%, 95%)", isGradient: false },
    { name: "Тёмный", value: "hsl(224, 30%, 12%)", isGradient: false },
    { name: "Закат", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", isGradient: true },
    { name: "Океан", value: "linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)", isGradient: true },
    { name: "Сиреневый", value: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)", isGradient: true },
    { name: "Лес", value: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)", isGradient: true },
    { name: "Вечер", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", isGradient: true },
    { name: "Коралл", value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", isGradient: true },
  ];

  const conversationId = selectedConversation
    ? selectedConversation.type === "direct"
      ? [user!.id, selectedConversation.contact.user_id].sort().join("_")
      : selectedConversation.group.id
    : "";

  const displayName = selectedConversation
    ? selectedConversation.type === "direct"
      ? selectedConversation.contact.full_name || "Пользователь"
      : selectedConversation.group.name
    : "";

  const isGroup = selectedConversation?.type === "group";

  // Загрузка контактов, групп и фона чата
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [usersSnap, convSnap, userSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(query(collection(db, "conversations"), where("participants", "array-contains", user.id))),
          getDoc(doc(db, "users", user.id)),
        ]);
        const all = usersSnap.docs
          .map(d => ({ user_id: d.id, ...d.data() } as Contact))
          .filter(c => c.user_id !== user.id);
        setContacts(all);
        setGroups(convSnap.docs.map(d => ({ id: d.id, ...d.data() } as GroupConversation)));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setChatThemes((d.chat_themes as Record<string, { chat_bg_color?: string; chat_bg_image?: string }>) || {});
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Открытие чата по ссылке из уведомления (?userId=... или ?conversationId=...)
  useEffect(() => {
    if (loading || !user) return;
    const userId = searchParams.get("userId");
    const conversationId = searchParams.get("conversationId");
    if (userId) {
      const contact = contacts.find((c) => c.user_id === userId);
      if (contact) {
        setSelectedConversation({ type: "direct", contact });
      }
      setSearchParams({}, { replace: true });
    } else if (conversationId) {
      const group = groups.find((g) => g.id === conversationId);
      if (group) {
        setSelectedConversation({ type: "group", group });
      }
      setSearchParams({}, { replace: true });
    }
  }, [loading, user, contacts, groups, searchParams, setSearchParams]);

  // При смене чата очищаем сообщения и индикатор «печатает» в предыдущем диалоге
  const prevConversationIdRef = useRef<string>("");
  useEffect(() => {
    if (prevConversationIdRef.current && prevConversationIdRef.current !== conversationId && user) {
      setDoc(doc(db, "typing", prevConversationIdRef.current), { [user.id]: deleteField() }, { merge: true }).catch(() => {});
    }
    prevConversationIdRef.current = conversationId || "";
    setMessages([]);
    setMessageSearch("");
  }, [conversationId, user]);

  // Сообщения в реальном времени (без orderBy в запросе — не нужен составной индекс, сортируем в коде)
  useEffect(() => {
    if (!user || !conversationId) {
      setMessages([]);
      return () => {};
    }
    const q = query(
      collection(db, "messages"),
      where("conversation_id", "==", conversationId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      msgs.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      setMessages(msgs);
      if (!isGroup) {
        msgs
          .filter(m => m.receiver_id === user.id && !m.is_read)
          .forEach(m => updateDoc(doc(db, "messages", m.id), { is_read: true }).catch(() => {}));
      }
    });
    return unsub;
  }, [user, conversationId, isGroup]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Обновляем свой last_seen пока пользователь на странице чата
  useEffect(() => {
    if (!user) return;
    const updatePresence = () => {
      updateDoc(doc(db, "users", user.id), { last_seen: new Date().toISOString() }).catch(() => {});
    };
    updatePresence();
    const interval = setInterval(updatePresence, 25_000);
    const onFocus = () => updatePresence();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  // Подписка на last_seen собеседника (только личный чат)
  const otherUserId = selectedConversation?.type === "direct" ? selectedConversation.contact.user_id : null;
  useEffect(() => {
    if (!otherUserId) {
      setContactLastSeen(null);
      return () => {};
    }
    const unsub = onSnapshot(doc(db, "users", otherUserId), (snap) => {
      const data = snap.data();
      setContactLastSeen((data?.last_seen as string) || null);
    });
    return unsub;
  }, [otherUserId]);

  // Подписка на индикатор «печатает» собеседника (только личный чат)
  const TYPING_THRESHOLD_MS = 5000;
  useEffect(() => {
    if (!conversationId || !otherUserId || !user) {
      setOtherUserTyping(false);
      return () => {};
    }
    const unsub = onSnapshot(doc(db, "typing", conversationId), (snap) => {
      const data = snap.data();
      const otherTs = data?.[otherUserId];
      if (!otherTs) {
        setOtherUserTyping(false);
        return;
      }
      const t = otherTs?.toMillis?.() ?? new Date(otherTs).getTime();
      setOtherUserTyping(Date.now() - t < TYPING_THRESHOLD_MS);
    });
    return unsub;
  }, [conversationId, otherUserId, user]);

  // Установка/сброс индикатора «печатает» при вводе сообщения (личный чат)
  const setTypingIndicator = (isTyping: boolean) => {
    if (!user || !conversationId || selectedConversation?.type !== "direct") return;
    const ref = doc(db, "typing", conversationId);
    if (isTyping) {
      setDoc(ref, { [user.id]: serverTimestamp() }, { merge: true }).catch(() => {});
    } else {
      setDoc(ref, { [user.id]: deleteField() }, { merge: true }).catch(() => {});
    }
  };
  const scheduleClearTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingIndicator(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const searchLower = contactSearch.trim().toLowerCase();
  const filteredContacts = searchLower
    ? contacts.filter(
        c =>
          (c.full_name || "").toLowerCase().includes(searchLower) ||
          (c.email || "").toLowerCase().includes(searchLower)
      )
    : contacts;
  const filteredGroups = searchLower
    ? groups.filter(g => (g.name || "").toLowerCase().includes(searchLower))
    : groups;

  const filteredMessages = messageSearch.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.trim().toLowerCase()))
    : messages;

  const senderNames: Record<string, string> = {};
  if (user) senderNames[user.id] = user.displayName || user.email || "Вы";
  contacts.forEach(c => {
    senderNames[c.user_id] = c.full_name || c.email || "Пользователь";
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedConversation) return;
    const content = newMessage.trim();
    const senderName = user.displayName || user.email || "Пользователь";
    const preview = content.length > 60 ? content.slice(0, 60) + "…" : content;
    try {
      await addDoc(collection(db, "messages"), {
        sender_id: user.id,
        receiver_id: selectedConversation.type === "direct" ? selectedConversation.contact.user_id : "",
        conversation_id: conversationId,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      const now = new Date().toISOString();
      if (selectedConversation.type === "direct") {
        const receiverId = selectedConversation.contact.user_id;
        await addDoc(collection(db, "notifications"), {
          user_id: receiverId,
          title: `Новое сообщение от ${senderName}`,
          message: preview,
          type: "message",
          is_read: false,
          created_at: now,
          sender_id: user.id,
        });
      } else {
        const group = selectedConversation.group;
        const recipientIds = group.participants.filter((id) => id !== user.id);
        await Promise.all(
          recipientIds.map((uid) =>
            addDoc(collection(db, "notifications"), {
              user_id: uid,
              title: `Новое сообщение в группе «${group.name || "Чат"}» от ${senderName}`,
              message: preview,
              type: "message",
              is_read: false,
              created_at: now,
              sender_id: user.id,
              conversation_id: group.id,
            })
          )
        );
      }

      setNewMessage("");
      if (selectedConversation?.type === "direct") setTypingIndicator(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.size === 0 || !user) {
      toast.error("Введите название группы и выберите хотя бы одного участника");
      return;
    }
    setCreatingGroup(true);
    try {
      const ref = await addDoc(collection(db, "conversations"), {
        type: "group",
        name: groupName.trim(),
        created_by: user.id,
        participants: [user.id, ...Array.from(selectedUserIds)],
        created_at: new Date().toISOString(),
      });
      const newGroup: GroupConversation = {
        id: ref.id,
        type: "group",
        name: groupName.trim(),
        created_by: user.id,
        participants: [user.id, ...Array.from(selectedUserIds)],
        created_at: new Date().toISOString(),
      };
      setGroups(prev => [...prev, newGroup]);
      setSelectedConversation({ type: "group", group: newGroup });
      setCreateGroupOpen(false);
      setGroupName("");
      setSelectedUserIds(new Set());
      toast.success("Группа создана");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleUserForGroup = (uid: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const openGroupSettings = () => {
    if (selectedConversation?.type !== "group") return;
    const g = selectedConversation.group;
    setEditGroupName(g.name);
    setEditGroupImageUrl(g.image_url || "");
    setSelectedIdsToAdd(new Set());
    setGroupSettingsOpen(true);
  };

  const isGroupCreator = selectedConversation?.type === "group" && user?.id === selectedConversation.group.created_by;

  const removeParticipant = async (uid: string) => {
    if (selectedConversation?.type !== "group" || !isGroupCreator) return;
    const g = selectedConversation.group;
    if (g.participants.length <= 1) {
      toast.error("В группе должен остаться хотя бы один участник");
      return;
    }
    const newParticipants = g.participants.filter(id => id !== uid);
    try {
      await updateDoc(doc(db, "conversations", g.id), { participants: newParticipants });
      const updated: GroupConversation = { ...g, participants: newParticipants };
      setGroups(prev => prev.map(gr => (gr.id === g.id ? updated : gr)));
      setSelectedConversation({ type: "group", group: updated });
      toast.success("Участник удалён");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleUserToAdd = (uid: string) => {
    setSelectedIdsToAdd(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const addParticipants = async () => {
    if (selectedConversation?.type !== "group" || selectedIdsToAdd.size === 0) return;
    const g = selectedConversation.group;
    const newParticipants = [...g.participants, ...Array.from(selectedIdsToAdd)];
    try {
      await updateDoc(doc(db, "conversations", g.id), { participants: newParticipants });
      const updated: GroupConversation = { ...g, participants: newParticipants };
      setGroups(prev => prev.map(gr => (gr.id === g.id ? updated : gr)));
      setSelectedConversation({ type: "group", group: updated });
      setSelectedIdsToAdd(new Set());
      toast.success("Участники добавлены");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGroupImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedConversation?.type !== "group") return;
    setUploadingGroupImage(true);
    try {
      const url = await uploadToCloudinary(file);
      setEditGroupImageUrl(url);
      toast.success("Фото загружено");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingGroupImage(false);
    }
  };

  const saveGroupSettings = async () => {
    if (selectedConversation?.type !== "group" || !editGroupName.trim()) return;
    setSavingGroup(true);
    try {
      const g = selectedConversation.group;
      await updateDoc(doc(db, "conversations", g.id), {
        name: editGroupName.trim(),
        image_url: editGroupImageUrl || "",
      });
      const updated: GroupConversation = { ...g, name: editGroupName.trim(), image_url: editGroupImageUrl || undefined };
      setGroups(prev => prev.map(gr => (gr.id === g.id ? updated : gr)));
      setSelectedConversation({ type: "group", group: updated });
      setGroupSettingsOpen(false);
      toast.success("Настройки группы сохранены");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const getParticipantDisplay = (uid: string) => {
    if (uid === user?.id) return user?.displayName || user?.email || "Вы";
    const c = contacts.find(x => x.user_id === uid);
    return c?.full_name || c?.email || "Участник";
  };

  const getParticipantAvatar = (uid: string) => {
    if (uid === user?.id) return null;
    return contacts.find(x => x.user_id === uid)?.avatar_url;
  };

  const openChatBgDialog = () => {
    const theme = conversationId ? chatThemes[conversationId] : undefined;
    setEditChatBgColor(theme?.chat_bg_color || "");
    setEditChatBgImage(theme?.chat_bg_image || "");
    setChatBgOpen(true);
  };

  const saveChatBg = async (color: string, image: string) => {
    if (!user || !conversationId) return;
    setSavingChatBg(true);
    try {
      const payload = { chat_bg_color: color, chat_bg_image: image };
      await updateDoc(doc(db, "users", user.id), { [`chat_themes.${conversationId}`]: payload });
      setChatThemes(prev => ({ ...prev, [conversationId]: payload }));
      await addDoc(collection(db, "messages"), {
        sender_id: user.id,
        receiver_id: "",
        conversation_id: conversationId,
        content: "",
        type: "theme_changed",
        theme_bg_color: color,
        theme_bg_image: image,
        is_read: false,
        created_at: new Date().toISOString(),
      });
      setChatBgOpen(false);
      toast.success("Фон чата сохранён");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingChatBg(false);
    }
  };

  const applyThemeToSelf = async (themeBgColor: string, themeBgImage: string) => {
    if (!user || !conversationId) return;
    try {
      const payload = { chat_bg_color: themeBgColor, chat_bg_image: themeBgImage };
      await updateDoc(doc(db, "users", user.id), { [`chat_themes.${conversationId}`]: payload });
      setChatThemes(prev => ({ ...prev, [conversationId]: payload }));
      toast.success("Фон применён");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleChatBgImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadToCloudinary(file);
      setEditChatBgImage(url);
      toast.success("Изображение загружено");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[100rem] mx-auto px-2 sm:px-4 lg:px-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold mb-3 sm:mb-4 lg:mb-6">Сообщения</h1>
      <div className="glass-card rounded-xl overflow-hidden flex h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] lg:h-[calc(100vh-180px)] min-h-[360px] sm:min-h-[420px] lg:min-h-[480px]">
        {/* Боковая панель: до 1024 скрыта при чате; lg 256px → xl 288px → hd 320px */}
        <div
          className={cn(
            "w-full lg:w-64 xl:w-72 min-hd:w-80 border-r border-border/30 flex flex-col flex-shrink-0 transition-[width] duration-200",
            selectedConversation ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="p-2 sm:p-3 lg:p-3 xl:p-3.5 min-hd:p-4 border-b border-border/30 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
              <Input
                placeholder="Поиск контакта или группы..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-7 sm:pl-8 h-8 sm:h-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs sm:text-sm lg:px-2 xl:px-2.5 min-hd:px-3"
              onClick={() => setCreateGroupOpen(true)}
            >
              <Users className="size-3.5 sm:size-4 flex-shrink-0" />
              <span className="truncate">Создать группу</span>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Группы</p>
                {                filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedConversation({ type: "group", group: g })}
                    className={cn(
                      "w-full text-left p-2 sm:p-3 lg:p-2.5 xl:p-3 min-hd:p-3.5 flex items-center gap-2 sm:gap-3 hover:bg-secondary/50 transition-colors rounded-lg",
                      selectedConversation?.type === "group" && selectedConversation.group.id === g.id && "bg-secondary/70"
                    )}
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {g.image_url ? (
                        <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs xl:text-sm font-medium truncate">{g.name}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="p-1.5 sm:p-2">
              <p className="text-xs font-medium text-muted-foreground px-1.5 sm:px-2 mb-1">Контакты</p>
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {contactSearch ? "Никого не найдено" : "Нет других пользователей"}
                </p>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => setSelectedConversation({ type: "direct", contact: c })}
                    className={cn(
                      "w-full text-left p-2 sm:p-3 lg:p-2.5 xl:p-3 min-hd:p-3.5 flex items-center gap-2 sm:gap-3 hover:bg-secondary/50 transition-colors rounded-lg",
                      selectedConversation?.type === "direct" && selectedConversation.contact.user_id === c.user_id && "bg-secondary/70"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${c.user_id}`); }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 ring-offset-2 ring-offset-transparent"
                    >
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{c.full_name?.charAt(0) || "?"}</span>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs xl:text-sm font-medium truncate">{c.full_name || "Пользователь"}</p>
                      {c.email && <p className="text-[10px] xl:text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Область чата: до 1024px показывается только при выбранном чате, на 1024px+ плейсхолдер при пустом выборе */}
        <div className={cn("flex-1 flex flex-col min-w-0", !selectedConversation && "hidden lg:flex")}>
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
              <p className="text-muted-foreground text-center text-sm sm:text-base">
                Выберите контакт или группу для переписки или создайте новую группу
              </p>
            </div>
          ) : (
            <>
              <div className="p-2 lg:p-3 xl:p-3.5 min-hd:p-4 border-b border-border/30 flex items-center gap-2 xl:gap-3 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 lg:hidden"
                  onClick={() => setSelectedConversation(null)}
                  title="Назад к списку"
                >
                  <ArrowLeft className="size-5" />
                </Button>
                {isGroup ? (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedConversation.group.image_url ? (
                      <img src={selectedConversation.group.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="size-4 text-primary" />
                    )}
                  </div>
                ) : (
                  selectedConversation.type === "direct" && (
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${selectedConversation.contact.user_id}`)}
                      className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 ring-offset-2 ring-offset-transparent"
                    >
                      {selectedConversation.contact.avatar_url ? (
                        <img src={selectedConversation.contact.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">
                          {selectedConversation.contact.full_name?.charAt(0) || "?"}
                        </span>
                      )}
                    </button>
                  )
                )}
                {isGroup ? (
                  <button
                    type="button"
                    onClick={openGroupSettings}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <p className="font-medium truncate">{displayName}</p>
                    <Pencil className="size-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                ) : (
                  selectedConversation.type === "direct" && (
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/${selectedConversation.contact.user_id}`)}
                        className="font-medium truncate text-left hover:underline w-full"
                      >
                        {displayName}
                      </button>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {otherUserTyping
                          ? "• • • печатает"
                          : contactLastSeen
                            ? (Date.now() - new Date(contactLastSeen).getTime() < 60_000
                                ? "В сети"
                                : "был(а) недавно")
                            : "был(а) недавно"}
                      </span>
                    </div>
                  )
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={openChatBgDialog}
                  title="Фон чата"
                >
                  <ImageIcon className="size-4" />
                </Button>
              </div>

              {messages.length > 0 && (
                <div className="px-3 py-2 border-b border-border/30 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по сообщениям..."
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              <div
                className="flex-1 overflow-y-auto p-2 lg:p-3 xl:p-4 min-hd:p-5 space-y-2 lg:space-y-3 xl:space-y-3.5 min-hd:space-y-4 min-h-0"
                style={(() => {
                  const theme = conversationId ? chatThemes[conversationId] : undefined;
                  const color = theme?.chat_bg_color || "";
                  const image = theme?.chat_bg_image || "";
                  return {
                    backgroundColor: color && !color.startsWith("linear-gradient") ? color : undefined,
                    backgroundImage: image ? `url(${image})` : color?.startsWith("linear-gradient") ? color : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  };
                })()}
              >
                {filteredMessages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    {messageSearch ? "Нет совпадений" : "Начните переписку"}
                  </p>
                )}
                {filteredMessages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const senderName = isOwn ? "Вы" : (senderNames[msg.sender_id] || "Пользователь");
                  const senderAvatar = msg.sender_id === user?.id ? null : (contacts.find(c => c.user_id === msg.sender_id)?.avatar_url ?? null);

                  if (msg.type === "theme_changed") {
                    return (
                      <div key={msg.id} className="flex flex-col items-center w-full py-1.5 lg:py-2">
                        <div className="rounded-xl lg:rounded-2xl bg-muted/80 dark:bg-muted/60 px-3 py-2 lg:px-4 lg:py-3 xl:px-4 xl:py-3.5 min-hd:px-5 min-hd:py-4 flex flex-col items-center gap-1.5 lg:gap-2 min-hd:gap-2.5 max-w-[260px] lg:max-w-[270px] xl:max-w-[280px] min-hd:max-w-[300px] border border-border/50">
                          <div className="w-9 h-9 lg:w-10 lg:h-10 xl:w-11 xl:h-11 min-hd:w-12 min-hd:h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {senderAvatar ? (
                              <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm lg:text-base xl:text-lg font-bold text-primary">
                                {(msg.sender_id === user?.id ? (user.displayName || user.email || "Вы") : senderName).charAt(0) || "?"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs lg:text-sm text-center text-foreground">
                            {isOwn
                              ? "Вы установили новые обои в этом чате"
                              : `${senderName} установил новые обои в этом чате`}
                          </p>
                          {!isOwn && (msg.theme_bg_color || msg.theme_bg_image) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full text-xs lg:text-sm"
                              onClick={() => applyThemeToSelf(msg.theme_bg_color || "", msg.theme_bg_image || "")}
                            >
                              Применить у себя
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                      {isGroup && !isOwn && (
                        <span className="text-xs text-muted-foreground mb-0.5 px-1">{senderName}</span>
                      )}
                      <div className={cn("flex w-full max-w-[90%] lg:max-w-[88%] xl:max-w-[86%] min-hd:max-w-[85%]", isOwn ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "w-fit max-w-full px-3 py-1.5 lg:px-3.5 lg:py-2 lg:text-sm xl:px-4 xl:py-2 xl:rounded-2xl min-hd:px-5 min-hd:py-2.5 rounded-xl text-xs bg-black text-white",
                            isOwn ? "rounded-br-sm" : "rounded-bl-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words min-w-0 text-white">{msg.content}</p>
                          <p className="text-[10px] lg:text-xs mt-0.5 lg:mt-1 text-white/80">
                            {(() => {
                            const d = new Date(msg.created_at);
                            const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                            const timeStr = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                            return `${dateStr}, ${timeStr}`;
                          })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEnd} />
              </div>

              <div className="p-2 lg:p-3 xl:p-3.5 min-hd:p-4 border-t border-border/30 flex gap-1.5 lg:gap-2 flex-shrink-0">
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (selectedConversation?.type === "direct") {
                      setTypingIndicator(true);
                      scheduleClearTyping();
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать сообщение..."
                  className="flex-1 h-9 lg:h-10 xl:h-10 min-hd:h-11 text-sm"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()} size="sm" className="flex-shrink-0">
                  Отправить
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Диалог создания группы */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать групповой чат</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Название группы</label>
              <Input
                placeholder="Например: Группа ИТ-21"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Участники</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Нет контактов</p>
                ) : (
                  contacts.map((c) => (
                    <label
                      key={c.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUserIds.has(c.user_id)}
                        onCheckedChange={() => toggleUserForGroup(c.user_id)}
                      />
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-primary">{c.full_name?.charAt(0) || "?"}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.full_name || "Пользователь"}</p>
                        {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateGroup} disabled={creatingGroup || !groupName.trim() || selectedUserIds.size === 0}>
              {creatingGroup ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог участников и настроек группы */}
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Участники и настройки группы</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedConversation?.type === "group" && selectedConversation.group.created_by && (
              <div className="text-sm text-muted-foreground">
                Создатель:{" "}
                <button
                  type="button"
                  onClick={() => navigate(selectedConversation.group.created_by === user?.id ? "/profile" : `/profile/${selectedConversation.group.created_by}`)}
                  className="font-medium text-foreground hover:underline"
                >
                  {getParticipantDisplay(selectedConversation.group.created_by)}
                </button>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Участники</label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                {selectedConversation?.type === "group" &&
                  selectedConversation.group.participants.map((uid) => (
                    <div key={uid} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                      <button
                        type="button"
                        onClick={() => navigate(uid === user?.id ? "/profile" : `/profile/${uid}`)}
                        className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 ring-offset-2 ring-offset-transparent"
                      >
                        {getParticipantAvatar(uid) ? (
                          <img src={getParticipantAvatar(uid)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {uid === user?.id ? "Вы" : getParticipantDisplay(uid).charAt(0) || "?"}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(uid === user?.id ? "/profile" : `/profile/${uid}`)}
                        className="text-sm font-medium truncate flex-1 min-w-0 text-left hover:underline"
                      >
                        {getParticipantDisplay(uid)}
                      </button>
                      {isGroupCreator && uid !== user?.id && selectedConversation?.type === "group" && selectedConversation.group.participants.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeParticipant(uid)}
                        >
                          Удалить
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
            {selectedConversation?.type === "group" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Добавить участников</label>
                {(() => {
                  const g = selectedConversation.group;
                  const availableToAdd = contacts.filter(c => !g.participants.includes(c.user_id));
                  if (availableToAdd.length === 0) {
                    return <p className="text-sm text-muted-foreground">Все ваши контакты уже в группе</p>;
                  }
                  return (
                    <>
                      <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 mb-2">
                        {availableToAdd.map((c) => (
                          <label key={c.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                            <Checkbox
                              checked={selectedIdsToAdd.has(c.user_id)}
                              onCheckedChange={() => toggleUserToAdd(c.user_id)}
                            />
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-primary">{c.full_name?.charAt(0) || "?"}</span>
                              )}
                            </div>
                            <p className="text-sm truncate">{c.full_name || c.email || "Пользователь"}</p>
                          </label>
                        ))}
                      </div>
                      <Button type="button" size="sm" onClick={addParticipants} disabled={selectedIdsToAdd.size === 0}>
                        Добавить выбранных ({selectedIdsToAdd.size})
                      </Button>
                    </>
                  );
                })()}
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Название группы</label>
              <Input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                placeholder="Название группы"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Фото группы</label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {editGroupImageUrl ? (
                    <img src={editGroupImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="size-6 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGroupImageChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => groupImageInputRef.current?.click()}
                    disabled={uploadingGroupImage}
                  >
                    {uploadingGroupImage ? "Загрузка..." : "Выбрать фото"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupSettingsOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={saveGroupSettings} disabled={savingGroup || !editGroupName.trim()}>
              {savingGroup ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог фона чата */}
      <Dialog open={chatBgOpen} onOpenChange={setChatBgOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Фон чата</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Цвет фона</p>
              <div className="grid grid-cols-4 gap-2">
                {chatBgPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => saveChatBg(preset.value, "")}
                    className="h-9 rounded-lg border-2 border-transparent hover:border-primary transition-colors"
                    style={
                      preset.isGradient
                        ? { backgroundImage: preset.value, backgroundSize: "cover" }
                        : { backgroundColor: preset.value }
                    }
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Или изображение</p>
              <input
                ref={chatBgImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChatBgImageChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => chatBgImageInputRef.current?.click()}
              >
                Выбрать изображение
              </Button>
              {editChatBgImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-destructive"
                  onClick={() => { setEditChatBgImage(""); saveChatBg(editChatBgColor, ""); }}
                >
                  Убрать изображение
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatBgOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={() => saveChatBg(editChatBgColor, editChatBgImage)} disabled={savingChatBg}>
              {savingChatBg ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
