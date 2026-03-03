import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { ScheduleItem } from "@/types";

const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

const lessonTypeBadge = "bg-black text-white";

const Schedule = () => {
  const today = new Date().getDay();
  const dayMap: Record<number, string> = { 1: "Понедельник", 2: "Вторник", 3: "Среда", 4: "Четверг", 5: "Пятница", 6: "Суббота", 0: "Понедельник" };
  const [activeDay, setActiveDay] = useState(dayMap[today] || "Понедельник");
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, "schedule"), orderBy("start_time")));
        setSchedule(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem)));
      } catch {
        // ignore errors
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dayIndex = days.indexOf(activeDay) + 1;
  const items = schedule.filter((s) => s.day_of_week === dayIndex);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-display font-bold">Расписание</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeDay === day
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {day}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">Нет занятий</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-card rounded-xl p-4 flex items-center gap-4"
            >
              <div className="text-center min-w-[72px]">
                <p className="text-sm font-mono font-bold text-primary">{item.start_time?.slice(0, 5)}</p>
                <p className="text-xs text-muted-foreground">{item.end_time?.slice(0, 5)}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.subject_name}</p>
                <p className="text-xs text-muted-foreground">Ауд. {item.room}</p>
              </div>
              <div className="text-right">
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", lessonTypeBadge)}>
                  {item.lesson_type}
                </span>
                {item.group_name && <p className="text-xs text-muted-foreground mt-1">{item.group_name}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Schedule;
