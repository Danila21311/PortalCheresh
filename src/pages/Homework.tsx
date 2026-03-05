import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, where, orderBy,
  doc, setDoc, deleteDoc, addDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Homework as HWType, HomeworkCompletion, HomeworkSubmission } from "@/types";

type Filter = "all" | "active" | "done";

const Homework = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HWType[]>([]);
  const [completions, setCompletions] = useState<HomeworkCompletion[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [currentTask, setCurrentTask] = useState<HWType | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [hwSnap, compSnap, subSnap] = await Promise.all([
        getDocs(query(collection(db, "homework"), orderBy("due_date"))),
        getDocs(query(collection(db, "homework_completions"), where("student_id", "==", user.id))),
        getDocs(query(collection(db, "homework_submissions"), where("student_id", "==", user.id))),
      ]);
      setTasks(hwSnap.docs.map(d => ({ id: d.id, ...d.data() } as HWType)));
      setCompletions(compSnap.docs.map(d => ({ id: d.id, ...d.data() } as HomeworkCompletion)));
      setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as HomeworkSubmission)));
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const isDone = (hwId: string) => completions.some((c) => c.homework_id === hwId);
  const getSubmission = (hwId: string) => submissions.find((s) => s.homework_id === hwId);
  const isUrgent = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  };

  const toggleDone = async (hwId: string) => {
    if (!user) return;
    const docId = `${hwId}_${user.id}`;
    if (isDone(hwId)) {
      await deleteDoc(doc(db, "homework_completions", docId));
    } else {
      await setDoc(doc(db, "homework_completions", docId), {
        homework_id: hwId,
        student_id: user.id,
        completed_at: new Date().toISOString(),
      });
    }
    load();
  };

  const openSubmitDialog = (task: HWType) => {
    setCurrentTask(task);
    setComment("");
    setSelectedFile(null);
    setSubmitDialog(true);
  };

  const downloadFile = (hwId: string) => {
    const sub = submissions.find(s => s.homework_id === hwId);
    if (!sub?.file_url) { toast.error("Файл не найден"); return; }
    window.open(sub.file_url, "_blank");
  };

  const submitWork = async () => {
    if (!user || !currentTask) return;
    if (!selectedFile && !comment.trim()) {
      toast.error("Прикрепите файл или напишите комментарий");
      return;
    }
    setSubmitting(true);
    try {
      let fileUrl = "";
      let fileName = "";

      if (selectedFile) {
        fileUrl = await uploadToCloudinary(selectedFile);
        fileName = selectedFile.name;
      }

      await addDoc(collection(db, "homework_submissions"), {
        homework_id: currentTask.id,
        homework_title: currentTask.title,
        subject_name: currentTask.subject_name,
        subject_id: currentTask.subject_id,
        student_id: user.id,
        file_url: fileUrl,
        file_name: fileName,
        comment,
        grade: null,
        teacher_comment: "",
        status: "submitted",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast.success("Работа отправлена!");
      setSubmitDialog(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tasks.filter((t) => {
    const done = isDone(t.id);
    if (filter === "active") return !done;
    if (filter === "done") return done;
    return true;
  });

  const activeCount = tasks.filter((t) => !isDone(t.id)).length;
  const urgentCount = tasks.filter((t) => !isDone(t.id) && isUrgent(t.due_date)).length;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Домашние задания</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="glass-card rounded-lg px-3 py-1.5">{activeCount} активных</span>
          {urgentCount > 0 && (
            <span className="bg-destructive/15 text-destructive rounded-lg px-3 py-1.5">{urgentCount} срочных</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {f === "all" ? "Все" : f === "active" ? "Активные" : "Выполненные"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">Нет заданий</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((hw, i) => {
            const done = isDone(hw.id);
            const urgent = isUrgent(hw.due_date);
            const submission = getSubmission(hw.id);

            return (
              <motion.div
                key={hw.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn("glass-card rounded-xl p-4 flex items-start gap-4", done && "opacity-60")}
              >
                <button
                  onClick={() => toggleDone(hw.id)}
                  className={cn("mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    done ? "bg-success border-success text-white" : "border-border hover:border-primary"
                  )}
                >
                  {done && <span className="text-xs">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("font-medium", done && "line-through")}>{hw.title}</p>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                      urgent && !done ? "bg-destructive/35 text-destructive font-semibold" : "bg-primary/25 text-primary dark:bg-primary/35 dark:text-primary-foreground"
                    )}>
                      до {new Date(hw.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{hw.subject_name}</p>
                  {hw.description && <p className="text-sm text-muted-foreground mt-1">{hw.description}</p>}
                  {hw.group_name && <p className="text-xs text-muted-foreground mt-1">Группа: {hw.group_name}</p>}

                  {submission && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs px-2 py-1 rounded inline-flex items-center gap-1",
                        submission.status === "graded" ? "bg-success/15 text-success" :
                        submission.status === "returned" ? "bg-destructive/15 text-destructive" :
                        "bg-accent/15 text-accent"
                      )}>
                        {submission.status === "submitted" ? "На проверке" :
                         submission.status === "graded" ? `Оценено: ${submission.grade}` :
                         "Возвращено на доработку"}
                      </span>
                      {submission.file_name && (
                        <button
                          onClick={() => downloadFile(hw.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          ⬇ {submission.file_name}
                        </button>
                      )}
                      {submission.teacher_comment && (
                        <p className="text-xs text-muted-foreground w-full mt-1">Комментарий: {submission.teacher_comment}</p>
                      )}
                    </div>
                  )}
                </div>

                {!submission && (
                  <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => openSubmitDialog(hw)}>
                    Сдать
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={submitDialog} onOpenChange={setSubmitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Сдать работу: {currentTask?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Файл (необязательно)</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  {selectedFile ? selectedFile.name : "Выбрать файл"}
                </Button>
                {selectedFile && (
                  <button onClick={() => setSelectedFile(null)} className="text-xs text-destructive hover:underline">
                    Убрать
                  </button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Файл сохраняется локально на устройстве</p>
            </div>
            <div>
              <Label>Комментарий</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="Комментарий к работе..."
                className="mt-1 resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">{comment.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitWork} disabled={submitting || (!selectedFile && !comment.trim())}>
              {submitting ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Homework;
