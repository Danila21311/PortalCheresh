import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const roleLabel = (r: string) => r === "admin" ? "Администратор" : r === "teacher" ? "Преподаватель" : "Студент";

const Profile = () => {
  const { user } = useAuth();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const viewUserId = routeUserId && routeUserId !== user?.id ? routeUserId : null;
  const isOwnProfile = !viewUserId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    group_name: "",
    bio: "",
    avatar_url: "",
    background_url: "",
  });
  const [role, setRole] = useState("");
  const [viewEmail, setViewEmail] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const targetId = viewUserId || user?.id;
    if (!targetId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", targetId));
        if (snap.exists()) {
          const p = snap.data();
          setProfile({
            full_name: p.full_name || "",
            group_name: p.group_name || "",
            bio: p.bio || "",
            avatar_url: p.avatar_url || "",
            background_url: p.background_url || "",
          });
          setRole(roleLabel(p.role || "student"));
          setViewEmail(p.email || "");
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, viewUserId]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setProfile(p => ({ ...p, avatar_url: url }));
      await updateDoc(doc(db, "users", user.id), { avatar_url: url });
      toast.success("Аватар обновлён");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setProfile(p => ({ ...p, background_url: url }));
      await updateDoc(doc(db, "users", user.id), { background_url: url });
      toast.success("Фон обновлён");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        full_name: profile.full_name,
        group_name: profile.group_name,
        bio: profile.bio,
      });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: profile.full_name });
      }
      toast.success("Профиль сохранён");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Загрузка...</p></div>;
  }

  const displayEmail = isOwnProfile ? user?.email : viewEmail;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        {!isOwnProfile && (
          <Link to="/chat" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" /> Назад к чату
          </Link>
        )}
        <h1 className="text-2xl md:text-3xl font-display font-bold">{isOwnProfile ? "Профиль" : "Профиль пользователя"}</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl overflow-hidden">
        {/* Background */}
        <div
          className="h-28 bg-gradient-to-r from-primary/30 to-primary/10 relative"
          style={profile.background_url ? { backgroundImage: `url(${profile.background_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        >
          {isOwnProfile && (
            <>
              <button
                onClick={() => bgInput.current?.click()}
                disabled={uploading}
                className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded hover:bg-black/70 transition-colors"
              >
                {uploading ? "Загрузка..." : "Изменить фон"}
              </button>
              <input ref={bgInput} type="file" accept="image/*" className="hidden" onChange={handleBgChange} />
            </>
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4 -mt-14">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-background flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-display font-bold text-primary">{profile.full_name?.charAt(0) || "?"}</span>
                )}
              </div>
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs hover:bg-primary/90 transition-colors"
                  >
                    ✎
                  </button>
                  <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </>
              )}
            </div>
            <div className="min-w-0 flex-1 mt-16">
              <p className="font-display font-semibold text-lg">{profile.full_name || "Имя не указано"}</p>
              {displayEmail && <p className="text-sm text-muted-foreground">{displayEmail}</p>}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground mt-1 inline-block border-0">{role}</span>
            </div>
          </div>

          {isOwnProfile ? (
            <>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ФИО</Label>
                    <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Иванов Иван Иванович" />
                  </div>
                  <div className="space-y-2">
                    <Label>Группа</Label>
                    <Input value={profile.group_name} onChange={(e) => setProfile({ ...profile, group_name: e.target.value })} placeholder="ИТ-21" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>О себе</Label>
                  <Textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Расскажите о себе..." rows={3} />
                </div>
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Группа</p>
                <p className="text-foreground">{profile.group_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">О себе</p>
                <p className="text-foreground whitespace-pre-wrap">{profile.bio || "—"}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
