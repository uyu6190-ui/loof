# Firebase / Cloud Firestore の初期設定

このアプリは Web 版で Cloud Firestore を使い、匿名認証ユーザーごとにデータを保存します。Firebase コンソールで一度だけ次を設定してください。

1. **Authentication** → **Sign-in method** で「匿名」を有効化する。
2. 同じ画面で「Google」を有効化し、サポート用メールアドレスを選んで保存する。
3. **Authentication** → **Settings** → **Authorized domains** に `loof-tau.vercel.app` を追加する。独自ドメインを設定した場合は、そのドメインも追加する。
4. **Firestore Database** を作成する（本番モードで可）。
5. **Rules** に以下を貼り付けて公開する。

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

ゲスト利用時の記録は端末内にだけ保存されます。Googleでログインした後は、そのGoogleアカウントのFirestore記録だけを使うため、ログイン前のゲスト記録が混ざることはありません。
