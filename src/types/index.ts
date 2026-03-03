export interface UserProfile {
  id: string;
  full_name: string;
  group_name: string;
  bio: string;
  avatar_url: string;
  background_url: string;
  sidebar_color: string;
  sidebar_image: string;
  role: "student" | "teacher" | "admin";
  email: string;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  teacher_name: string;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  subject_id: string;
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  lesson_type: string;
  group_name: string;
  created_at: string;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  subject_name: string;
  grade: number;
  comment: string;
  created_at: string;
}

export interface Homework {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  description: string;
  due_date: string;
  group_name: string;
  created_at: string;
}

export interface HomeworkCompletion {
  id: string;
  homework_id: string;
  student_id: string;
  completed_at: string;
}

export interface HomeworkSubmission {
  id: string;
  homework_id: string;
  homework_title: string;
  subject_name: string;
  subject_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  comment: string;
  grade: number | null;
  teacher_comment: string;
  status: "submitted" | "graded" | "returned";
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string; // пусто для групповых чатов
  conversation_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  /** Системное сообщение о смене фона чата */
  type?: "theme_changed";
  theme_bg_color?: string;
  theme_bg_image?: string;
}

export interface GroupConversation {
  id: string;
  type: "group";
  name: string;
  image_url?: string;
  created_by?: string; // uid создателя группы
  participants: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  /** id отправителя сообщения — для перехода в личный чат */
  sender_id?: string;
  /** id группового чата — для перехода в группу */
  conversation_id?: string;
}
