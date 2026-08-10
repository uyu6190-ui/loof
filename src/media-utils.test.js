import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_IMAGE_INPUT_BYTES,
  imageOutputType,
  isRetryableStorageError,
  storageErrorMessage,
  validateImageFile,
} from "./media-utils.js";

test("画像以外・空ファイル・容量超過を拒否する", () => {
  assert.match(validateImageFile({ type: "text/plain", size: 10 }), /画像ファイル/);
  assert.match(validateImageFile({ type: "image/png", size: 0 }), /空/);
  assert.match(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_INPUT_BYTES + 1 }), /25MB/);
  assert.equal(validateImageFile({ type: "image/jpeg", size: 1024 }), "");
});

test("透過画像とGIFの形式を維持する", () => {
  assert.equal(imageOutputType("image/png"), "image/png");
  assert.equal(imageOutputType("image/webp"), "image/webp");
  assert.equal(imageOutputType("image/gif"), "image/gif");
  assert.equal(imageOutputType("image/heic"), "image/jpeg");
});

test("Firebaseの料金・権限・端末容量エラーを利用者向けに分類する", () => {
  assert.match(storageErrorMessage({ code: "storage/quota-exceeded" }), /Blaze/);
  assert.match(storageErrorMessage({ code: "storage/unauthorized" }), /権限/);
  assert.match(storageErrorMessage({ name: "QuotaExceededError" }), /端末の保存容量/);
});

test("一時的なStorageエラーだけを再試行する", () => {
  assert.equal(isRetryableStorageError({ code: "storage/unknown" }), true);
  assert.equal(isRetryableStorageError({ code: "storage/unauthorized" }), false);
  assert.equal(isRetryableStorageError({ code: "storage/quota-exceeded" }), false);
});
