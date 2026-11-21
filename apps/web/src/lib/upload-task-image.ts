import queryClient from "@/query-client";
import createImageUpload, {
  finalizeImageUpload,
} from "@/fetchers/task/create-image-upload";

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type UploadSurface = "description" | "comment" | "attachment";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(Math.ceil((size / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
}

// fetch() has no upload progress events, so XHR is used when a caller wants them.
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers))
      xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Failed to upload file to storage."));
    xhr.onerror = () => reject(new Error("Failed to upload file to storage."));
    xhr.send(file);
  });
}

export function isSupportedImageFile(file: File) {
  return allowedImageMimeTypes.has(file.type.toLowerCase());
}

export function isSupportedTaskAsset(file: File) {
  return file.size > 0;
}

export function getImageAltText(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export async function uploadTaskImage({
  taskId,
  surface,
  file,
  onProgress,
}: {
  taskId: string;
  surface: UploadSurface;
  file: File;
  onProgress?: (percent: number) => void;
}) {
  if (!isSupportedImageFile(file)) {
    if (!isSupportedTaskAsset(file)) {
      throw new Error("Only non-empty file uploads are supported.");
    }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${file.name || "File"} is ${formatFileSize(file.size)}. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB per file.`,
    );
  }

  const contentType = file.type || "application/octet-stream";

  const upload = await createImageUpload({
    taskId,
    filename: file.name || "image",
    contentType,
    size: file.size,
    surface,
  });

  if (onProgress) {
    await putWithProgress(upload.uploadUrl, upload.headers, file, onProgress);
  } else {
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload file to storage.");
    }
  }

  const asset = await finalizeImageUpload({
    taskId,
    key: upload.key,
    filename: file.name || "image",
    contentType,
    size: file.size,
    surface,
  });

  if (!isSupportedImageFile(file) || surface === "attachment") {
    void queryClient.invalidateQueries({
      queryKey: ["task-attachments", taskId],
    });
  }

  return {
    url: asset.url,
    alt: getImageAltText(file.name || "image"),
    filename: file.name || "file",
    kind: isSupportedImageFile(file) ? "image" : "attachment",
    mimeType: contentType,
    size: file.size,
  };
}
