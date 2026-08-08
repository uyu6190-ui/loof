import assert from "node:assert/strict";
import test from "node:test";
import { storedArray, upsertStoredItem } from "./storage-utils.js";

test("保存済み配列を復元する", () => {
  assert.deepEqual(storedArray('[{"id":"old"}]', { strict: true }), [{ id: "old" }]);
  assert.deepEqual(storedArray(null, { strict: true }), []);
});

test("破損した保存データを空配列として上書きしない", () => {
  assert.throws(() => storedArray("not-json", { strict: true }), /読み取れません/);
  assert.throws(() => storedArray('{"id":"not-an-array"}', { strict: true }), /形式が不正/);
});

test("新規項目を追加して既存項目を保持する", () => {
  const oldItem = { id: "old", text: "過去" };
  const newItem = { id: "new", text: "新規" };
  assert.deepEqual(upsertStoredItem([oldItem], newItem), [newItem, oldItem]);
});

test("同じIDの項目だけを更新する", () => {
  const values = [{ id: "one", text: "変更前" }, { id: "two", text: "保持" }];
  assert.deepEqual(upsertStoredItem(values, { id: "one", text: "変更後" }), [
    { id: "one", text: "変更後" },
    { id: "two", text: "保持" }
  ]);
});
