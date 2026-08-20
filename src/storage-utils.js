export function storedArray(value, { strict = false } = {}) {
  if (value == null) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    if (strict) throw new Error("保存済みデータを読み取れません", { cause: error });
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (strict) throw new Error("保存済みデータの形式が不正です");
  return [];
}

export function upsertStoredItem(values, item) {
  if (!item?.id || item.isAll) return values;
  const index = values.findIndex(value => value?.id === item.id);
  if (index === -1) return [item, ...values];
  const next = values.slice();
  next[index] = item;
  return next;
}
