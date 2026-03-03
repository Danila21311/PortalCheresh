const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload any file to Cloudinary (free, no backend needed).
 * Returns the public URL of the uploaded file.
 */
export const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!CLOUD_NAME || CLOUD_NAME === "your-cloud-name") {
    throw new Error("Cloudinary не настроен. Заполните VITE_CLOUDINARY_CLOUD_NAME и VITE_CLOUDINARY_UPLOAD_PRESET в файле .env");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const resourceType = file.type.startsWith("image/") ? "image" : "raw";
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(url, { method: "POST", body: formData });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Ошибка загрузки файла");
  }

  const data = await response.json();
  return data.secure_url as string;
};
