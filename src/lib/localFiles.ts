// Utility to store and retrieve files as base64 in localStorage

export const saveFileToLocal = (key: string, file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      try {
        localStorage.setItem(key, base64);
        resolve(base64);
      } catch {
        reject(new Error("Файл слишком большой для сохранения. Максимум ~4MB."));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
};

export const loadFileFromLocal = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const removeFileFromLocal = (key: string) => {
  localStorage.removeItem(key);
};

export const avatarKey = (userId: string) => `studhub_avatar_${userId}`;
export const bgKey = (userId: string) => `studhub_bg_${userId}`;
export const sidebarImgKey = (userId: string) => `studhub_sidebar_${userId}`;
export const hwFileKey = (hwId: string, userId: string) => `studhub_hw_${hwId}_${userId}`;
