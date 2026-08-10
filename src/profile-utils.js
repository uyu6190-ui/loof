export function canEditAccount(account) {
  return Boolean(account?.id && !account.isAll);
}

export async function saveProfile(onSave, account, onSuccess) {
  const saved = await onSave(account);
  if (saved) onSuccess();
  return saved;
}
