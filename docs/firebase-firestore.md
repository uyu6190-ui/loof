# Firebase / Cloud Firestore の初期設定

このアプリは Google ログインしたユーザーごとに Cloud Firestore を使います。ゲスト利用時の記録は端末内だけに保存されます。Firebase コンソールで一度だけ次を設定してください。

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

## 同期の安全設計

新しいデータは、`users/{uid}/entries/{entryId}`、`accounts/{accountId}`、`collections/{collectionId}` のように1件ずつ保存されます。`nb.entries` のような配列全体を保存・上書きすることはありません。

各ドキュメントには `updatedAt: serverTimestamp()`、`clientUpdatedAt`、`clientId` を記録します。古い `clientUpdatedAt` の端末からの書き込みは拒否され、削除も tombstone として1件ずつ同期されます。起動時はローカルキャッシュを使わず、まずFirestoreサーバーから復元します。画像を含む大きな投稿は、更新世代ごとの `revisions/{revision}/chunks` に分割されるため、古い端末が同じchunk IDで新しい画像を上書きすることもありません。

過去のバージョンが保存した `users/{uid}/storage/nb.entries` などは、最初の起動時に一度だけ個別ドキュメントへ移行します。ブラウザーやPWAのlocalStorage/IndexedDBは移行元にしないため、古い端末のローカル状態でFirestoreを上書きしません。

同期の記録はブラウザーの開発者ツールのConsoleで `[loof sync]` として確認できます。実際の更新・削除・古い更新の拒否は `users/{uid}/syncLogs` にも記録されるため、端末ごとの `clientId`、対象の種類・ID、時刻を後から確認できます。

このリポジトリにはService Workerの登録処理はありません。念のため、過去のPWA版が残したService Workerは起動時に解除し、最新のJavaScriptを読み直します。
