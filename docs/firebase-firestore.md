# Firebase / Cloud Firestore の初期設定

このアプリは Google ログインしたユーザーごとに Cloud Firestore を使います。ゲスト利用時の記録は端末内だけに保存されます。Firebase コンソールで一度だけ次を設定してください。

1. **Authentication** → **Sign-in method** で「匿名」を有効化する。
2. 同じ画面で「Google」を有効化し、サポート用メールアドレスを選んで保存する。
3. **Authentication** → **Settings** → **Authorized domains** に `loof-tau.vercel.app` を追加する。独自ドメインを設定した場合は、そのドメインも追加する。
4. **Firestore Database** を作成する（本番モードで可）。
5. **Storage** を開いて有効化する（画像本体の保存先）。
6. Firestore の **Rules** に以下を貼り付けて公開する。

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

7. Storage の **Rules** に以下を貼り付けて公開する。

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 同期の安全設計

新しいデータは、`users/{uid}/entries/{entryId}`、`accounts/{accountId}`、`collections/{collectionId}` のように1件ずつ保存されます。`nb.entries` のような配列全体を保存・上書きすることはありません。

各ドキュメントには `updatedAt: serverTimestamp()`、`clientUpdatedAt`、`clientId` を記録します。古い `clientUpdatedAt` の端末からの書き込みは拒否され、削除も tombstone として1件ずつ同期されます。起動時はユーザー別の表示専用キャッシュを先に表示し、最新100件をサーバーで確認するまでは更新操作を受け付けません。キャッシュの配列全体をFirestoreへ書き戻すことはありません。

タイムラインは最新100件が確認できた時点で利用可能になり、残りの履歴と旧データ回復はバックグラウンドで統合します。検索、カレンダー、画像一覧に必要な全履歴はその後自動的に揃います。削除済みtombstoneは表示から除外しますが、「今回の一覧に無い」投稿を削除扱いにはしません。

画像本体は `users/{uid}/media/...` にFirebase Storageへ保存し、Firestoreの投稿にはダウンロードURLだけを保存します。そのため複数画像でもFirestoreのドキュメント・バッチ上限に引っかかりません。過去のdata URL画像は読めるまま残り、投稿を次回編集・保存した時点でStorage URLへ移行します。

過去のバージョンが保存した `users/{uid}/storage/nb.entries` などは個別ドキュメントへ移行します。途中で止まった旧移行もV2リカバリーで再走査し、更新日時の比較によって現行データを巻き戻さず、不足している項目だけを再統合します。旧チャンク形式の投稿も読み込まれます。ブラウザーやPWAのlocalStorage/IndexedDBは移行元にしないため、古い端末のローカル状態でFirestoreを上書きしません。

同期の記録はブラウザーの開発者ツールのConsoleで `[loof sync]` として確認できます。実際の更新・削除・古い更新の拒否は `users/{uid}/syncLogs` にも記録されるため、端末ごとの `clientId`、対象の種類・ID、時刻を後から確認できます。

このリポジトリにはService Workerの登録処理はありません。念のため、過去のPWA版が残したService Workerは起動時に解除し、最新のJavaScriptを読み直します。
