# Firebase / Cloud Firestore の初期設定

このアプリは Web 版で Cloud Firestore を使い、匿名認証ユーザーごとにデータを保存します。Firebase コンソールで一度だけ次を設定してください。

1. **Authentication** → **Sign-in method** で「匿名」を有効化する。
2. **Firestore Database** を作成する（本番モードで可）。
3. **Rules** に以下を貼り付けて公開する。

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

既に端末にあるデータは、最初に Firebase へ接続した時点で自動的に移行されます。匿名認証はブラウザ・端末ごとに別のユーザーになるため、複数端末で同じデータを共有するには、次の段階として Google などのログイン方式を有効にしてください。
