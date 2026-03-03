import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Вы успешно вошли!");
        navigate("/");
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const { user } = credential;

        await updateProfile(user, { displayName: fullName });

        await setDoc(doc(db, "users", user.uid), {
          full_name: fullName,
          email,
          group_name: "",
          bio: "",
          avatar_url: "",
          background_url: "",
          sidebar_color: "",
          sidebar_image: "",
          role: "student",
          created_at: serverTimestamp(),
        });

        toast.success("Регистрация успешна! Добро пожаловать!");
        navigate("/");
      }
    } catch (err: any) {
      const messages: Record<string, string> = {
        "auth/user-not-found": "Пользователь не найден",
        "auth/wrong-password": "Неверный пароль",
        "auth/email-already-in-use": "Email уже используется",
        "auth/weak-password": "Пароль слишком слабый (минимум 6 символов)",
        "auth/invalid-email": "Неверный формат email",
        "auth/invalid-credential": "Неверный email или пароль",
      };
      toast.error(messages[err.code] || err.message || "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/logo.png" alt="PortalCheresh" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-display font-bold">PortalCheresh</h1>
          <p className="text-muted-foreground mt-1">Личный кабинет студента</p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isLogin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              Вход
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isLogin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">ФИО</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@univ.ru" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Загрузка..." : isLogin ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
