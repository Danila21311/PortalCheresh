import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Grade, Homework, ScheduleItem, Subject } from "@/types";

// Единая палитра для оценок: 5 — зелёный, 4 — бирюзовый, 3 — фиолетовый, 2 — красный
const GRADE_COLORS: Record<number, string> = {
  5: "hsl(152, 60%, 42%)",
  4: "hsl(175, 55%, 38%)",
  3: "hsl(265, 55%, 48%)",
  2: "hsl(0, 72%, 51%)",
};

const gradeColorValue = (g: number) => GRADE_COLORS[g] ?? GRADE_COLORS[2];

const Index = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const [gradesSnap, hwSnap, schedSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, "grades"), where("student_id", "==", user.id))),
          getDocs(query(collection(db, "homework"), orderBy("due_date"))),
          getDocs(query(collection(db, "schedule"), orderBy("start_time"))),
          getDocs(collection(db, "subjects")),
        ]);

        setGrades(gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setHomework(hwSnap.docs.map(d => ({ id: d.id, ...d.data() } as Homework)));
        setSchedule(schedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem)));
        setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      } catch {
        // ignore errors
      }
    };

    load();
  }, [user]);

  const today = new Date().getDay();
  const dayMap: Record<number, number> = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
  const todaySchedule = schedule.filter((s) => s.day_of_week === dayMap[today]);

  const activeHomework = homework.filter((h) => new Date(h.due_date) >= new Date());
  const urgentCount = homework.filter((h) => {
    const diff = new Date(h.due_date).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  }).length;

  const avgGrade = grades.length > 0
    ? (grades.reduce((a, g) => a + g.grade, 0) / grades.length).toFixed(1)
    : "—";

  const gradesBySubject = subjects.map((sub) => {
    const subGrades = grades.filter((g) => g.subject_id === sub.id);
    const avg = subGrades.length > 0
      ? +(subGrades.reduce((a, g) => a + g.grade, 0) / subGrades.length).toFixed(1)
      : 0;
    return { name: sub.name.length > 10 ? sub.name.slice(0, 10) + "…" : sub.name, avg, count: subGrades.length };
  }).filter((d) => d.count > 0);

  const gradeDistribution = [5, 4, 3, 2].map((g) => ({
    name: String(g),
    value: grades.filter((gr) => gr.grade === g).length,
  })).filter((d) => d.value > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Добро пожаловать!</h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Пар сегодня" value={todaySchedule.length} variant="default" />
        <StatCard label="Средний балл" value={avgGrade} variant="success" />
        <StatCard label="Активных заданий" value={activeHomework.length} sub={urgentCount > 0 ? `${urgentCount} срочных` : undefined} variant="accent" />
        <StatCard label="Предметов" value={subjects.length} variant="default" />
      </div>

      {grades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Средний балл по предметам</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradesBySubject}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avg" fill="hsl(234, 62%, 46%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Распределение оценок</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                  {gradeDistribution.map((entry, i) => (
                    <Cell key={i} fill={gradeColorValue(Number(entry.name))} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-4">Расписание на сегодня</h2>
          {todaySchedule.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Нет занятий сегодня</p>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <span className="text-sm font-mono font-medium text-primary w-24">{item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.subject_name}</p>
                    <p className="text-xs text-muted-foreground">Ауд. {item.room} · {item.lesson_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Последние оценки</h2>
            {grades.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Пока нет оценок</p>
            ) : (
              <div className="space-y-3">
                {grades.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{g.subject_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString("ru-RU")}</p>
                    </div>
                    <span className="text-xl font-display font-bold" style={{ color: gradeColorValue(g.grade) }}>{g.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-xl p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Ближайшие задания</h2>
            {activeHomework.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Нет активных заданий</p>
            ) : (
              <div className="space-y-3">
                {activeHomework.slice(0, 5).map((hw, i) => {
                  const diff = new Date(hw.due_date).getTime() - Date.now();
                  const urgent = diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{hw.title}</p>
                        <p className="text-xs text-muted-foreground">{hw.subject_name}</p>
                      </div>
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full",
                        urgent ? "bg-destructive/35 text-destructive font-semibold" : "bg-primary/25 text-primary dark:bg-primary/35 dark:text-primary-foreground"
                      )}>
                        до {new Date(hw.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
