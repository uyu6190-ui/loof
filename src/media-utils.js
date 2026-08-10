export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;

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

export function storageErrorMessage(error, fallback = "保存できませんでした。もう一度お試しください。") {
  const code = error?.code || "";
  const detail = `${error?.message || ""}`;

  if (code === "resource-exhausted" || code === "firestore/resource-exhausted" || code === "storage/quota-exceeded") {
    return "クラウド保存の無料利用枠または容量に達しました。不要な画像を削除してから、もう一度お試しください。";
  }
  if (code === "storage/unauthorized" || code === "permission-denied" || /\b403\b|permission|権限/i.test(detail)) {
    return "クラウドへ保存する権限がありません。ログイン状態とFirestoreのルールを確認してください。";
  }
  if (code === "unauthenticated") {
    return "ログイン状態を確認できませんでした。再読み込みして、もう一度お試しください。";
  }
  if (code === "unavailable" || code === "deadline-exceeded" || /network|offline|timeout/i.test(detail)) {
    return "クラウド保存が完了しませんでした。通信を確認して、もう一度お試しください。";
  }
  if (error?.name === "QuotaExceededError") {
    return "端末の保存容量が不足しています。不要な画像を削除して、もう一度お試しください。";
  }
  if (/別の端末で更新/.test(detail)) return detail;
  return detail.trim() || fallback;
}
