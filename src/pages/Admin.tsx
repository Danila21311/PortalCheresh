import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy,
  doc, getDoc, updateDoc, addDoc, deleteDoc, writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Subject, ScheduleItem, Grade, Homework } from "@/types";

const seedDemoData = async () => {
  const subjects = [
    { name: "Математический анализ", teacher_name: "Иванова Е.А." },
    { name: "Программирование на Python", teacher_name: "Петров А.С." },
    { name: "Базы данных", teacher_name: "Сидорова М.В." },
    { name: "Операционные системы", teacher_name: "Кузнецов Д.Н." },
    { name: "Английский язык", teacher_name: "Смирнова О.И." },
  ];

  const batch = writeBatch(db);
  const subjectIds: string[] = [];

  for (const s of subjects) {
    const ref = doc(collection(db, "subjects"));
    subjectIds.push(ref.id);
    batch.set(ref, { ...s, created_at: new Date().toISOString() });
  }
  await batch.commit();

  const scheduleItems = [
    { subject_idx: 0, day_of_week: 1, start_time: "08:30", end_time: "10:00", room: "101", lesson_type: "Лекция", group_name: "ИТ-21" },
    { subject_idx: 1, day_of_week: 1, start_time: "10:10", end_time: "11:40", room: "205", lesson_type: "Практика", group_name: "ИТ-21" },
    { subject_idx: 2, day_of_week: 2, start_time: "08:30", end_time: "10:00", room: "301", lesson_type: "Лекция", group_name: "ИТ-21" },
    { subject_idx: 3, day_of_week: 2, start_time: "10:10", end_time: "11:40", room: "Lab-1", lesson_type: "Лабораторная", group_name: "ИТ-21" },
    { subject_idx: 4, day_of_week: 3, start_time: "12:00", end_time: "13:30", room: "204", lesson_type: "Практика", group_name: "ИТ-21" },
    { subject_idx: 0, day_of_week: 4, start_time: "08:30", end_time: "10:00", room: "101", lesson_type: "Практика", group_name: "ИТ-21" },
    { subject_idx: 1, day_of_week: 5, start_time: "10:10", end_time: "11:40", room: "Lab-2", lesson_type: "Лабораторная", group_name: "ИТ-21" },
    { subject_idx: 2, day_of_week: 5, start_time: "13:40", end_time: "15:10", room: "301", lesson_type: "Семинар", group_name: "ИТ-21" },
  ];

  const batch2 = writeBatch(db);
  for (const item of scheduleItems) {
    const ref = doc(collection(db, "schedule"));
    batch2.set(ref, {
      subject_id: subjectIds[item.subject_idx],
      subject_name: subjects[item.subject_idx].name,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
      room: item.room,
      lesson_type: item.lesson_type,
      group_name: item.group_name,
      created_at: new Date().toISOString(),
    });
  }
  await batch2.commit();

  const now = new Date();
  const addDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString().split("T")[0];

  const homeworkItems = [
    { subject_idx: 0, title: "Контрольная работа №1: Пределы и производные", description: "Решить задачи 1-20 из раздела 3.2. Оформить решение в тетради.", due_date: addDays(3), group_name: "ИТ-21" },
    { subject_idx: 1, title: "Лабораторная работа: Алгоритмы сортировки", description: "Реализовать пузырьковую, быструю и сортировку слиянием на Python. Сравнить время выполнения.", due_date: addDays(5), group_name: "ИТ-21" },
    { subject_idx: 2, title: "Проектирование схемы БД интернет-магазина", description: "Создать ER-диаграмму и SQL-скрипт для создания таблиц. Минимум 5 сущностей.", due_date: addDays(7), group_name: "ИТ-21" },
    { subject_idx: 3, title: "Установка и настройка Linux", description: "Установить Ubuntu в виртуальной машине, настроить сеть и SSH. Сделать скриншоты.", due_date: addDays(10), group_name: "ИТ-21" },
    { subject_idx: 4, title: "Эссе: Technologies of the Future", description: "Написать эссе на тему технологий будущего. Объём: 250-300 слов.", due_date: addDays(14), group_name: "ИТ-21" },
    { subject_idx: 1, title: "Курсовой проект: Телеграм-бот", description: "Разработать Telegram-бота с командами /start, /help и минимум 3 функциями на выбор.", due_date: addDays(21), group_name: "ИТ-21" },
  ];

  const batch3 = writeBatch(db);
  for (const hw of homeworkItems) {
    const ref = doc(collection(db, "homework"));
    batch3.set(ref, {
      subject_id: subjectIds[hw.subject_idx],
      subject_name: subjects[hw.subject_idx].name,
      title: hw.title,
      description: hw.description,
      due_date: hw.due_date,
      group_name: hw.group_name,
      created_at: new Date().toISOString(),
    });
  }
  await batch3.commit();
};

const dayNames = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.id))
      .then(snap => setIsAdmin(snap.exists() && snap.data()?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [user]);

  if (authLoading || isAdmin === null) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      toast.success("Демо-данные добавлены! Обновите страницу.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Админ-панель</h1>
        <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
          {seeding ? "Загрузка..." : "Заполнить демо-данными"}
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="subjects">Предметы</TabsTrigger>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
          <TabsTrigger value="grades">Оценки</TabsTrigger>
          <TabsTrigger value="homework">Задания</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
        <TabsContent value="schedule"><ScheduleTab /></TabsContent>
        <TabsContent value="grades"><GradesTab /></TabsContent>
        <TabsContent value="homework"><HomeworkTab /></TabsContent>
      </Tabs>
    </div>
  );
};

/* ==================== USERS ==================== */
const UsersTab = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("student");

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ user_id: d.id, ...d.data() })));
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openRoleDialog = (u: any) => {
    setSelectedUser(u);
    setNewRole(u.role || "student");
    setRoleDialog(true);
  };

  const saveRole = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, "users", selectedUser.user_id), { role: newRole });
      toast.success("Роль обновлена");
      setRoleDialog(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const roleLabel = (r: string) => r === "admin" ? "Администратор" : r === "teacher" ? "Преподаватель" : "Студент";
  const roleBadgeClass = "bg-muted text-foreground border-0";

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h2 className="font-display font-semibold text-lg">Управление пользователями</h2>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Группа</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                <TableCell>{u.group_name || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${roleBadgeClass}`}>
                    {roleLabel(u.role)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openRoleDialog(u)}>Изменить</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Нет пользователей</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p className="text-sm">Пользователь: <strong>{selectedUser.full_name}</strong></p>
              <div>
                <Label>Роль</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Студент</SelectItem>
                    <SelectItem value="teacher">Преподаватель</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveRole}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== SUBJECTS ==================== */
const SubjectsTab = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", teacher_id: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [subSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "users")),
      ]);
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setTeachers(
        usersSnap.docs
          .filter(d => d.data().role === "teacher")
          .map(d => ({ user_id: d.id, full_name: (d.data().full_name || d.data().email || d.id).toString() }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", teacher_id: teachers[0]?.user_id || "" }); setDialogOpen(true); };
  const openEdit = (s: Subject) => {
    setEditing(s);
    const teacherId = teachers.find(t => t.full_name === s.teacher_name)?.user_id || teachers[0]?.user_id || "";
    setForm({ name: s.name, teacher_id: teacherId });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Введите название предмета"); return; }
    const teacher_name = teachers.find(t => t.user_id === form.teacher_id)?.full_name ?? "";
    if (!teacher_name) { toast.error("Выберите преподавателя"); return; }
    const payload = { name: form.name.trim(), teacher_name };
    try {
      if (editing) {
        await updateDoc(doc(db, "subjects", editing.id), payload);
        toast.success("Предмет обновлён");
      } else {
        await addDoc(collection(db, "subjects"), { ...payload, created_at: new Date().toISOString() });
        toast.success("Предмет добавлен");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "subjects", id));
      toast.success("Предмет удалён");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Предметы</h2>
        <Button onClick={openNew} size="sm">Добавить</Button>
      </div>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Преподаватель</TableHead><TableHead className="w-24">Действия</TableHead></TableRow></TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.teacher_name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>✎</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.id)} className="text-destructive">✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {subjects.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Нет предметов</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Редактировать предмет" : "Новый предмет"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Название</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 200) })} maxLength={200} /></div>
            <div>
              <Label>Преподаватель</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите преподавателя" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {teachers.length === 0 && <p className="text-xs text-muted-foreground">Нет пользователей с ролью «Преподаватель»</p>}
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Сохранить" : "Добавить"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== SCHEDULE ==================== */
const ScheduleTab = () => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [roomOptions, setRoomOptions] = useState<string[]>([]);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState({ subject_id: "", day_of_week: "1", start_time: "08:30", end_time: "10:00", room: "", lesson_type: "Лекция", group_name: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [schedSnap, subSnap, hwSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "schedule"), orderBy("start_time"))),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "homework")),
        getDocs(collection(db, "users")),
      ]);
      const scheduleItems = schedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem))
        .sort((a, b) => a.day_of_week - b.day_of_week || (a.start_time || "").localeCompare(b.start_time || ""));
      setItems(scheduleItems);
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject))
        .sort((a, b) => a.name.localeCompare(b.name)));
      const rooms = [...new Set(scheduleItems.map(s => s.room).filter(Boolean))] as string[];
      setRoomOptions(rooms.sort());
      const groupsFromSchedule = scheduleItems.map(s => s.group_name).filter(Boolean);
      const groupsFromHw = hwSnap.docs.map(d => d.data().group_name).filter(Boolean);
      const groupsFromUsers = usersSnap.docs.map(d => d.data().group_name).filter(Boolean);
      const groups = [...new Set([...groupsFromSchedule, ...groupsFromHw, ...groupsFromUsers])] as string[];
      setGroupOptions(groups.sort());
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ subject_id: subjects[0]?.id || "", day_of_week: "1", start_time: "08:30", end_time: "10:00", room: "", lesson_type: "Лекция", group_name: "" });
    setDialogOpen(true);
  };
  const openEdit = (s: ScheduleItem) => {
    setEditing(s);
    setForm({ subject_id: s.subject_id, day_of_week: String(s.day_of_week), start_time: s.start_time, end_time: s.end_time, room: s.room, lesson_type: s.lesson_type, group_name: s.group_name });
    setDialogOpen(true);
  };

  const save = async () => {
    const sub = subjects.find(s => s.id === form.subject_id);
    const payload = {
      subject_id: form.subject_id,
      subject_name: sub?.name || "",
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room,
      lesson_type: form.lesson_type,
      group_name: form.group_name,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "schedule", editing.id), payload);
        toast.success("Расписание обновлено");
      } else {
        await addDoc(collection(db, "schedule"), { ...payload, created_at: new Date().toISOString() });
        toast.success("Занятие добавлено");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "schedule", id));
      toast.success("Удалено");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Расписание</h2>
        <Button onClick={openNew} size="sm" disabled={subjects.length === 0}>Добавить</Button>
      </div>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>День</TableHead><TableHead>Время</TableHead><TableHead>Предмет</TableHead><TableHead>Тип</TableHead><TableHead>Ауд.</TableHead><TableHead>Группа</TableHead><TableHead className="w-24">Действия</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{dayNames[s.day_of_week] || s.day_of_week}</TableCell>
                <TableCell className="font-mono text-sm">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</TableCell>
                <TableCell className="font-medium">{s.subject_name}</TableCell>
                <TableCell>{s.lesson_type}</TableCell>
                <TableCell>{s.room}</TableCell>
                <TableCell>{s.group_name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>✎</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.id)} className="text-destructive">✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Нет записей</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Редактировать занятие" : "Новое занятие"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Предмет</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>День недели</Label>
              <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5,6].map((d) => <SelectItem key={d} value={String(d)}>{dayNames[d]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Начало</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>Конец</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Тип занятия</Label>
              <Select value={form.lesson_type} onValueChange={(v) => setForm({ ...form, lesson_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Лекция","Практика","Лабораторная","Семинар"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Аудитория</Label>
              <Select value={form.room || "_empty"} onValueChange={(v) => setForm({ ...form, room: v === "_empty" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Выберите аудиторию" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">— Не указано —</SelectItem>
                  {form.room && !roomOptions.includes(form.room) && <SelectItem value={form.room}>{form.room}</SelectItem>}
                  {roomOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Группа</Label>
              <Select value={form.group_name || "_empty"} onValueChange={(v) => setForm({ ...form, group_name: v === "_empty" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Выберите группу" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">— Не указано —</SelectItem>
                  {form.group_name && !groupOptions.includes(form.group_name) && <SelectItem value={form.group_name}>{form.group_name}</SelectItem>}
                  {groupOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Сохранить" : "Добавить"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== GRADES ==================== */
const GradesTab = () => {
  const [items, setItems] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({ student_id: "", subject_id: "", grade: "5", comment: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [gradesSnap, subSnap, profSnap] = await Promise.all([
        getDocs(collection(db, "grades")),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "users")),
      ]);
      setItems(gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setProfiles(
        profSnap.docs
          .filter(d => {
            const role = d.data().role as string | undefined;
            return role !== "admin" && role !== "teacher";
          })
          .map(d => ({ user_id: d.id, full_name: d.data().full_name || "" }))
      );
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const studentName = (sid: string) => profiles.find(p => p.user_id === sid)?.full_name || sid.slice(0, 8);

  const openNew = () => {
    setEditing(null);
    setForm({ student_id: profiles[0]?.user_id || "", subject_id: subjects[0]?.id || "", grade: "5", comment: "" });
    setDialogOpen(true);
  };
  const openEdit = (g: Grade) => {
    setEditing(g);
    setForm({ student_id: g.student_id, subject_id: g.subject_id, grade: String(g.grade), comment: g.comment || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    const sub = subjects.find(s => s.id === form.subject_id);
    const payload = {
      student_id: form.student_id,
      subject_id: form.subject_id,
      subject_name: sub?.name || "",
      grade: Number(form.grade),
      comment: form.comment,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "grades", editing.id), payload);
        toast.success("Оценка обновлена");
      } else {
        await addDoc(collection(db, "grades"), { ...payload, created_at: new Date().toISOString() });
        toast.success("Оценка добавлена");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "grades", id));
      toast.success("Удалено");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Оценки</h2>
        <Button onClick={openNew} size="sm" disabled={subjects.length === 0 || profiles.length === 0}>Добавить</Button>
      </div>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Студент</TableHead><TableHead>Предмет</TableHead><TableHead>Оценка</TableHead><TableHead>Комментарий</TableHead><TableHead className="w-24">Действия</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{studentName(g.student_id)}</TableCell>
                <TableCell className="font-medium">{g.subject_name}</TableCell>
                <TableCell><span className="font-display font-bold text-lg">{g.grade}</span></TableCell>
                <TableCell className="text-sm text-muted-foreground">{g.comment}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>✎</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(g.id)} className="text-destructive">✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Нет оценок</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Редактировать оценку" : "Новая оценка"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Студент</Label>
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.user_id.slice(0, 8)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Предмет</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Оценка (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                inputMode="numeric"
                value={form.grade}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || v === "1" || v === "2" || v === "3" || v === "4" || v === "5") setForm({ ...form, grade: v });
                  else if (v.length > 1) {
                    const last = v.slice(-1);
                    if ("12345".includes(last)) setForm({ ...form, grade: last });
                  }
                }}
              />
            </div>
            <div>
              <Label>Комментарий</Label>
              <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value.slice(0, 500) })} maxLength={500} className="resize-none" />
              <p className="text-xs text-muted-foreground">{form.comment.length}/500</p>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Сохранить" : "Добавить"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ==================== HOMEWORK ==================== */
const HomeworkTab = () => {
  const [items, setItems] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Homework | null>(null);
  const [form, setForm] = useState({ subject_id: "", title: "", description: "", due_date: "", group_name: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [hwSnap, subSnap, schedSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "homework")),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "schedule")),
        getDocs(collection(db, "users")),
      ]);
      setItems(hwSnap.docs.map(d => ({ id: d.id, ...d.data() } as Homework))
        .sort((a, b) => b.due_date.localeCompare(a.due_date)));
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject))
        .sort((a, b) => a.name.localeCompare(b.name)));
      const fromHw = hwSnap.docs.map(d => d.data().group_name).filter(Boolean);
      const fromSched = schedSnap.docs.map(d => d.data().group_name).filter(Boolean);
      const fromUsers = usersSnap.docs.map(d => d.data().group_name).filter(Boolean);
      const groups = [...new Set([...fromHw, ...fromSched, ...fromUsers])] as string[];
      setGroupOptions(groups.sort());
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ subject_id: subjects[0]?.id || "", title: "", description: "", due_date: new Date().toISOString().split("T")[0], group_name: "" });
    setDialogOpen(true);
  };
  const openEdit = (h: Homework) => {
    setEditing(h);
    setForm({ subject_id: h.subject_id, title: h.title, description: h.description || "", due_date: h.due_date, group_name: h.group_name });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Введите название задания"); return; }
    const sub = subjects.find(s => s.id === form.subject_id);
    const payload = { ...form, subject_name: sub?.name || "" };
    try {
      if (editing) {
        await updateDoc(doc(db, "homework", editing.id), payload);
        toast.success("Задание обновлено");
      } else {
        await addDoc(collection(db, "homework"), { ...payload, created_at: new Date().toISOString() });
        // Уведомляем всех студентов о новом задании
        const studentsSnap = await getDocs(collection(db, "users"));
        const notifBatch = writeBatch(db);
        studentsSnap.docs.forEach(d => {
          if (d.data().role === "student") {
            const ref = doc(collection(db, "notifications"));
            notifBatch.set(ref, {
              user_id: d.id,
              title: `Новое задание: ${form.title}`,
              message: `Предмет: ${sub?.name || "—"}. Срок сдачи: ${form.due_date}.`,
              type: "homework",
              is_read: false,
              created_at: new Date().toISOString(),
            });
          }
        });
        await notifBatch.commit();
        toast.success("Задание добавлено");
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "homework", id));
      toast.success("Удалено");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Домашние задания</h2>
        <Button onClick={openNew} size="sm" disabled={subjects.length === 0}>Добавить</Button>
      </div>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Задание</TableHead><TableHead>Предмет</TableHead><TableHead>Срок</TableHead><TableHead>Группа</TableHead><TableHead className="w-24">Действия</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((h) => (
              <TableRow key={h.id}>
                <TableCell>
                  <p className="font-medium">{h.title}</p>
                  {h.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{h.description}</p>}
                </TableCell>
                <TableCell>{h.subject_name}</TableCell>
                <TableCell className="font-mono text-sm">{h.due_date}</TableCell>
                <TableCell>{h.group_name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>✎</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(h.id)} className="text-destructive">✕</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Нет заданий</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Редактировать задание" : "Новое задание"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Предмет</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 200) })} maxLength={200} /></div>
            <div><Label>Описание</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 1000) })} maxLength={1000} className="resize-none" /><p className="text-xs text-muted-foreground">{form.description.length}/1000</p></div>
            <div><Label>Срок сдачи</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Группа</Label>
              <Select value={form.group_name || "_empty"} onValueChange={(v) => setForm({ ...form, group_name: v === "_empty" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Выберите группу" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_empty">— Не указано —</SelectItem>
                  {form.group_name && !groupOptions.includes(form.group_name) && <SelectItem value={form.group_name}>{form.group_name}</SelectItem>}
                  {groupOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Сохранить" : "Добавить"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
