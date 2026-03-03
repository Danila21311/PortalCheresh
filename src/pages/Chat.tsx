import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where,
  addDoc, onSnapshot, updateDoc, doc, getDoc,
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
import { Users, Search, Pencil, ImageIcon } from "lucide-react";
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
  const messagesEnd = useRef<HTMLDivElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const chatBgImageInputRef = useRef<HTMLInputElement>(null);

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

  // При смене чата сразу очищаем сообщения, чтобы не показывать переписку из другого диалога
  useEffect(() => {
    setMessages([]);
    setMessageSearch("");
  }, [conversationId]);

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
    try {
      await addDoc(collection(db, "messages"), {
        sender_id: user.id,
        receiver_id: selectedConversation.type === "direct" ? selectedConversation.contact.user_id : "",
        conversation_id: conversationId,
        content: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      });
      setNewMessage("");
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
      setChatBgOpen(false);
      toast.success("Фон чата сохранён");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingChatBg(false);
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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold mb-6">Сообщения</h1>
      <div className="glass-card rounded-xl overflow-hidden flex h-[calc(100vh-200px)] min-h-[400px]">
        {/* Боковая панель: поиск + контакты и группы */}
        <div className="w-72 border-r border-border/30 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border/30 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Поиск контакта или группы..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setCreateGroupOpen(true)}
            >
              <Users className="size-4" />
              Создать группу
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Группы</p>
                {filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedConversation({ type: "group", group: g })}
                    className={cn(
                      "w-full text-left p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors rounded-lg",
                      selectedConversation?.type === "group" && selectedConversation.group.id === g.id && "bg-secondary/70"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {g.image_url ? (
                        <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{g.name}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Контакты</p>
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
                      "w-full text-left p-3 flex items-center gap-3 hover:bg-secondary/50 transition-colors rounded-lg",
                      selectedConversation?.type === "direct" && selectedConversation.contact.user_id === c.user_id && "bg-secondary/70"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{c.full_name?.charAt(0) || "?"}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.full_name || "Пользователь"}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Область чата */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-muted-foreground text-center">
                Выберите контакт или группу для переписки или создайте новую группу
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border/30 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {isGroup ? (
                    selectedConversation.group.image_url ? (
                      <img src={selectedConversation.group.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="size-4 text-primary" />
                    )
                  ) : (
                    selectedConversation.type === "direct" && (
                      selectedConversation.contact.avatar_url ? (
                        <img src={selectedConversation.contact.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">
                          {selectedConversation.contact.full_name?.charAt(0) || "?"}
                        </span>
                      )
                    )
                  )}
                </div>
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
                  <p className="font-medium truncate flex-1">{displayName}</p>
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
                className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
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
                  return (
                    <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                      {isGroup && !isOwn && (
                        <span className="text-xs text-muted-foreground mb-0.5 px-1">{senderName}</span>
                      )}
                      <div className={cn("flex w-full max-w-[85%]", isOwn ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "w-fit max-w-full px-4 py-2 rounded-2xl text-sm bg-black text-white",
                            isOwn ? "rounded-br-sm" : "rounded-bl-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words min-w-0 text-white">{msg.content}</p>
                          <p className="text-xs mt-1 text-white/80">
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

              <div className="p-3 border-t border-border/30 flex gap-2 flex-shrink-0">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать сообщение..."
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
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
                Создатель: <span className="font-medium text-foreground">{getParticipantDisplay(selectedConversation.group.created_by)}</span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Участники</label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                {selectedConversation?.type === "group" &&
                  selectedConversation.group.participants.map((uid) => (
                    <div key={uid} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {getParticipantAvatar(uid) ? (
                          <img src={getParticipantAvatar(uid)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {uid === user?.id ? "Вы" : getParticipantDisplay(uid).charAt(0) || "?"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate flex-1 min-w-0">{getParticipantDisplay(uid)}</p>
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
