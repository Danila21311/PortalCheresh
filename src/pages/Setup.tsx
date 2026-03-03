import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const accounts = [
  {
    email: "admin@cherHub.ru",
    password: "Admin123!",
    full_name: "Администратор Системы",
    role: "admin",
    group_name: "",
    label: "Администратор",
  },
  {
    email: "teacher@cherHub.ru",
    password: "Teacher123!",
    full_name: "Преподаватель Иванов А.С.",
    role: "teacher",
    group_name: "",
    label: "Преподаватель",
  },
];

const Setup = () => {
  const [done, setDone] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const createAccounts = async () => {
    setLoading(true);
    const created: string[] = [];

    for (const acc of accounts) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.password);
        await updateProfile(cred.user, { displayName: acc.full_name });
        await setDoc(doc(db, "users", cred.user.uid), {
          email: acc.email,
          full_name: acc.full_name,
          role: acc.role,
          group_name: acc.group_name,
          bio: "",
          avatar_url: "",
          background_url: "",
          sidebar_color: "",
          sidebar_image: "",
          created_at: new Date().toISOString(),
        });
        created.push(acc.label);
        toast.success(`${acc.label} создан`);
      } catch (err: any) {
        if (err.code === "auth/email-already-in-use") {
          created.push(acc.label + " (уже существует)");
          toast.info(`${acc.label}: аккаунт уже существует`);
        } else {
          toast.error(`${acc.label}: ${err.message}`);
        }
      }
    }

    setDone(created);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 glass-card rounded-xl p-8">
        <div>
          <h1 className="text-2xl font-display font-bold">Создание демо-аккаунтов</h1>
          <p className="text-muted-foreground text-sm mt-1">Нажмите кнопку чтобы создать аккаунт администратора и преподавателя</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="font-semibold">Администратор</p>
            <p className="text-muted-foreground">Логин: <span className="font-mono text-foreground">admin@cherHub.ru</span></p>
            <p className="text-muted-foreground">Пароль: <span className="font-mono text-foreground">Admin123!</span></p>
            <p className="text-xs text-muted-foreground mt-1">Полный доступ: управление пользователями, предметами, расписанием, оценками и заданиями</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="font-semibold">Преподаватель</p>
            <p className="text-muted-foreground">Логин: <span className="font-mono text-foreground">teacher@cherHub.ru</span></p>
            <p className="text-muted-foreground">Пароль: <span className="font-mono text-foreground">Teacher123!</span></p>
            <p className="text-xs text-muted-foreground mt-1">Доступ к кабинету преподавателя: просмотр и оценивание работ студентов</p>
          </div>
        </div>

        {done.length > 0 ? (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 space-y-2">
            <p className="font-semibold text-green-600">Готово!</p>
            {done.map(d => <p key={d} className="text-sm text-muted-foreground">✓ {d}</p>)}
            <p className="text-sm mt-2">Теперь можно войти через <a href="/auth" className="text-primary underline">/auth</a></p>
          </div>
        ) : (
          <Button className="w-full" onClick={createAccounts} disabled={loading}>
            {loading ? "Создание аккаунтов..." : "Создать аккаунты"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Setup;
