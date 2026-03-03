import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy,
  doc, updateDoc, addDoc, getDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { HomeworkSubmission } from "@/types";

const statusLabels: Record<string, string> = {
  submitted: "На проверке",
  graded: "Оценено",
  returned: "Возвращено",
};
const statusColors: Record<string, string> = {
  submitted: "bg-accent/15 text-accent",
  graded: "bg-success/15 text-success",
  returned: "bg-destructive/15 text-destructive",
};

const TeacherDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.id))
      .then(snap => setIsTeacher(snap.exists() && snap.data()?.role === "teacher"))
      .catch(() => setIsTeacher(false));
  }, [user]);

  if (authLoading || isTeacher === null) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }
  if (!isTeacher) return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold">Панель преподавателя</h1>

      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="submissions">Работы студентов</TabsTrigger>
          <TabsTrigger value="grades">Выставить оценки</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
        <TabsContent value="grades"><TeacherGradesTab /></TabsContent>
      </Tabs>
    </div>
  );
};

const SubmissionsTab = () => {
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [current, setCurrent] = useState<HomeworkSubmission | null>(null);
  const [gradeVal, setGradeVal] = useState("5");
  const [teacherComment, setTeacherComment] = useState("");
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [subSnap, profSnap] = await Promise.all([
        getDocs(query(collection(db, "homework_submissions"), orderBy("created_at", "desc"))),
        getDocs(collection(db, "users")),
      ]);
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as HomeworkSubmission)));
      setProfiles(profSnap.docs.map(d => ({ user_id: d.id, full_name: d.data().full_name || "" })));
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const studentName = (sid: string) => profiles.find(p => p.user_id === sid)?.full_name || sid.slice(0, 8);

  const openReview = (s: HomeworkSubmission) => {
    setCurrent(s);
    setGradeVal(s.grade ? String(s.grade) : "5");
    setTeacherComment(s.teacher_comment || "");
    setReviewDialog(true);
  };

  const saveGrade = async () => {
    if (!current) return;
    try {
      await updateDoc(doc(db, "homework_submissions", current.id), {
        grade: Number(gradeVal),
        teacher_comment: teacherComment,
        status: "graded",
        updated_at: new Date().toISOString(),
      });

      if (current.subject_id) {
        await addDoc(collection(db, "grades"), {
          student_id: current.student_id,
          subject_id: current.subject_id,
          subject_name: current.subject_name || "",
          grade: Number(gradeVal),
          comment: `Задание: ${current.homework_title}. ${teacherComment}`,
          created_at: new Date().toISOString(),
        });
      }

      await addDoc(collection(db, "notifications"), {
        user_id: current.student_id,
        title: `Оценка за задание: ${Number(gradeVal)}`,
        message: `Предмет: ${current.subject_name || "—"}. Задание: "${current.homework_title}".${teacherComment ? ` Комментарий: ${teacherComment}` : ""}`,
        type: "grade",
        is_read: false,
        created_at: new Date().toISOString(),
      });

      toast.success("Оценка выставлена");
      setReviewDialog(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const returnSubmission = async () => {
    if (!current) return;
    try {
      await updateDoc(doc(db, "homework_submissions", current.id), {
        teacher_comment: teacherComment,
        status: "returned",
        updated_at: new Date().toISOString(),
      });
      toast.success("Работа возвращена студенту");
      setReviewDialog(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h2 className="font-display font-semibold text-lg">Присланные работы</h2>
      {loading ? <p className="text-muted-foreground text-center">Загрузка...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Студент</TableHead>
              <TableHead>Задание</TableHead>
              <TableHead>Предмет</TableHead>
              <TableHead>Файл</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Оценка</TableHead>
              <TableHead className="w-20">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{studentName(s.student_id)}</TableCell>
                <TableCell className="font-medium">{s.homework_title || "—"}</TableCell>
                <TableCell>{s.subject_name || "—"}</TableCell>
                <TableCell>
                  <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                    {s.file_name || "Файл"}
                  </a>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[s.status] || ""}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                </TableCell>
                <TableCell className="font-display font-bold">{s.grade || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openReview(s)}>Проверить</Button>
                </TableCell>
              </TableRow>
            ))}
            {submissions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Нет работ</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Проверка работы</DialogTitle></DialogHeader>
          {current && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Студент</p>
                <p className="font-medium">{studentName(current.student_id)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Задание</p>
                <p className="font-medium">{current.homework_title}</p>
              </div>
              {current.comment && (
                <div>
                  <p className="text-sm text-muted-foreground">Комментарий студента</p>
                  <p className="text-sm">{current.comment}</p>
                </div>
              )}
              <div>
                <a href={current.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Скачать файл: {current.file_name}
                </a>
              </div>
              <div>
                <Label>Оценка (1-5)</Label>
                <Input type="number" min={1} max={5} value={gradeVal} onChange={(e) => setGradeVal(e.target.value)} />
              </div>
              <div>
                <Label>Комментарий преподавателя</Label>
                <Textarea value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} placeholder="Комментарий к работе..." />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={returnSubmission}>Вернуть</Button>
            <Button onClick={saveGrade}>Оценить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TeacherGradesTab = () => {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", subject_id: "", grade: "5", comment: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [subSnap, profSnap] = await Promise.all([
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "users")),
      ]);
      const subs = subSnap.docs.map(d => ({ id: d.id, name: d.data().name || "" }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(subs);
      setProfiles(profSnap.docs.map(d => ({ user_id: d.id, full_name: d.data().full_name || "" })));
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const sub = subjects.find(s => s.id === form.subject_id);
    try {
      await addDoc(collection(db, "grades"), {
        student_id: form.student_id,
        subject_id: form.subject_id,
        subject_name: sub?.name || "",
        grade: Number(form.grade),
        comment: form.comment,
        created_at: new Date().toISOString(),
      });
      toast.success("Оценка выставлена");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-semibold text-lg">Выставить оценку</h2>
        <Button
          onClick={() => {
            setForm({ student_id: profiles[0]?.user_id || "", subject_id: subjects[0]?.id || "", grade: "5", comment: "" });
            setDialogOpen(true);
          }}
          size="sm"
          disabled={loading}
        >
          Выставить оценку
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Выберите студента, предмет и оценку для выставления.</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новая оценка</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Студент</Label>
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.user_id.slice(0, 8)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Предмет</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Оценка (1-5)</Label><Input type="number" min={1} max={5} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
            <div><Label>Комментарий</Label><Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Выставить</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
