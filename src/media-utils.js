export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
const RETRYABLE_STORAGE_CODES = new Set([
  "storage/unknown",
  "storage/retry-limit-exceeded",
  "storage/server-file-wrong-size",
]);

export function validateImageFile(file, maxBytes = MAX_IMAGE_INPUT_BYTES) {
  if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
    return "画像ファイルを選んでください。";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "空の画像ファイルは読み込めません。";
  }
  if (file.size > maxBytes) {
    return `画像は${Math.round(maxBytes / 1024 / 1024)}MB以下にしてください。`;
  }
  return "";
}

export function imageOutputType(inputType) {
  if (inputType === "image/gif") return "image/gif";
  if (inputType === "image/png") return "image/png";
  if (inputType === "image/webp") return "image/webp";
  return "image/jpeg";
}

export function isRetryableStorageError(error) {
  return RETRYABLE_STORAGE_CODES.has(error?.code);
}

export function storageErrorMessage(error, fallback = "保存できませんでした。もう一度お試しください。") {
  const code = error?.code || "";
  const detail = `${error?.message || ""}`;

  if (code === "storage/quota-exceeded" || /\b402\b|Spark pricing plan|billing account|料金プラン/i.test(detail)) {
    return "画像保存用のFirebase Storageが利用できません。管理者がBlazeプランと請求先を設定する必要があります。";
  }
  if (code === "storage/unauthorized" || code === "permission-denied" || /\b403\b|permission|権限/i.test(detail)) {
    return "画像を保存する権限がありません。Firebase Storageのルールを確認してください。";
  }
  if (code === "storage/bucket-not-found" || /bucket.+not found/i.test(detail)) {
    return "画像保存先がまだ作成されていません。Firebase Storageを有効にしてください。";
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled" || /network|offline|timeout/i.test(detail)) {
    return "画像の送信が完了しませんでした。通信を確認して、もう一度お試しください。";
  }
  if (error?.name === "QuotaExceededError" || /quota|容量/i.test(detail)) {
    return "端末の保存容量が不足しています。不要な画像を削除して、もう一度お試しください。";
  }
  if (/別の端末で更新/.test(detail)) return detail;
  return detail.trim() || fallback;
}
