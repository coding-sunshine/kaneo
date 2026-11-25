import {
  createDocumentFileUpload,
  finalizeDocumentFileUpload,
} from "@/fetchers/document/documents";
import {
  formatFileSize,
  getImageAltText,
  MAX_UPLOAD_BYTES,
} from "./upload-task-image";

export async function uploadDocumentFile({
  workspaceId,
  documentId,
  file,
}: {
  workspaceId: string;
  documentId: string;
  file: File;
}) {
  if (file.size <= 0) {
    throw new Error("Only non-empty file uploads are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${file.name || "File"} is ${formatFileSize(file.size)}. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB per file.`,
    );
  }

  const name = file.name || "file";
  const upload = await createDocumentFileUpload(workspaceId, documentId, {
    filename: name,
    size: file.size,
  });

  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload file to storage.");
  }

  const asset = await finalizeDocumentFileUpload(workspaceId, documentId, {
    key: upload.key,
    filename: name,
    size: file.size,
  });

  return {
    url: asset.url,
    alt: getImageAltText(name),
    filename: name,
    kind: asset.kind,
    mimeType: asset.mimeType,
    size: file.size,
  };
}
