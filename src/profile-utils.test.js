import assert from "node:assert/strict";
import test from "node:test";
import { canEditAccount, saveProfile } from "./profile-utils.js";

test("通常のノートだけプロフィールを編集できる", () => {
  assert.equal(canEditAccount({ id: "note" }), true);
  assert.equal(canEditAccount({ id: "all", isAll: true }), false);
  assert.equal(canEditAccount(null), false);
});

test("プロフィール保存失敗を呼び出し元へ返して編集画面を閉じない", async () => {
  let closed = false;
  const saved = await saveProfile(async () => false, { id: "note" }, () => { closed = true; });

  assert.equal(saved, false);
  assert.equal(closed, false);
});

test("プロフィール保存成功時だけ編集画面を閉じる", async () => {
  let closed = false;
  const saved = await saveProfile(async () => true, { id: "note" }, () => { closed = true; });

  assert.equal(saved, true);
  assert.equal(closed, true);
});
