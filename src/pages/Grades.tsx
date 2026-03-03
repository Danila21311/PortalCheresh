import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import type { Grade } from "@/types";

const gradeColor = (g: number) => {
  if (g === 5) return "bg-success/15 text-success border border-success/30";
  if (g === 4) return "bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30";
  if (g === 3) return "bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30";
  return "bg-destructive/15 text-destructive border border-destructive/30";
};

const gradeLabel = (g: number) => {
  if (g === 5) return "Отлично";
  if (g === 4) return "Хорошо";
  if (g === 3) return "Удовл.";
  return "Неудовл.";
};

const Grades = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "list">("summary");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const q = query(collection(db, "grades"), where("student_id", "==", user.id));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
        list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        setGrades(list);
      } catch (err) {
        console.error("Ошибка загрузки оценок:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Group grades by subject
  const bySubject = grades.reduce<Record<string, { name: string; grades: Grade[] }>>((acc, g) => {
    const key = g.subject_id || g.subject_name;
    if (!acc[key]) acc[key] = { name: g.subject_name, grades: [] };
    acc[key].grades.push(g);
    return acc;
  }, {});

  const subjectList = Object.values(bySubject).map(s => {
    const vals = s.grades.map(g => g.grade);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const last = vals[0];
    const prev = vals[1];
    const trend = prev !== undefined ? (last > prev ? "up" : last < prev ? "down" : "stable") : "stable";
    return { ...s, avg, trend };
  });

  const overallAvg = subjectList.length > 0
    ? (subjectList.reduce((a, s) => a + s.avg, 0) / subjectList.length).toFixed(2)
    : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Оценки</h1>
        {overallAvg && (
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Средний балл:</span>
            <span className="text-xl font-display font-bold text-primary">{overallAvg}</span>
          </div>
        )}
      </div>

      {grades.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center space-y-2">
          <p className="text-muted-foreground text-lg">Оценок пока нет</p>
          <p className="text-sm text-muted-foreground">Оценки появятся после проверки работ преподавателем</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab("summary")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === "summary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              По предметам
            </button>
            <button
              onClick={() => setTab("list")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === "list" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Все оценки ({grades.length})
            </button>
          </div>

          {tab === "summary" && (
            <div className="space-y-4">
              {subjectList.map((sub, i) => (
                <motion.div
                  key={sub.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold">{sub.name}</h3>
                      <p className="text-xs text-muted-foreground">{sub.grades.length} {sub.grades.length === 1 ? "оценка" : "оценок"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-sm font-medium",
                        sub.trend === "up" ? "text-success" : sub.trend === "down" ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {sub.trend === "up" ? "↑" : sub.trend === "down" ? "↓" : "—"}
                      </span>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Средний</p>
                        <p className="text-xl font-display font-bold text-primary">{sub.avg.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {sub.grades.map((g) => (
                      <span key={g.id} className={cn("text-sm font-display font-bold px-3 py-1.5 rounded-lg", gradeColor(g.grade))}>
                        {g.grade}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {tab === "list" && (
            <div className="space-y-3">
              {grades.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-xl p-4 flex items-start gap-4"
                >
                  <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center", gradeColor(g.grade))}>
                    <span className="text-xl font-display font-bold leading-none">{g.grade}</span>
                    <span className="text-[10px] font-medium leading-tight mt-0.5">{gradeLabel(g.grade)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{g.subject_name || "Предмет"}</p>
                    {g.comment && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{g.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(g.created_at).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Grades;
