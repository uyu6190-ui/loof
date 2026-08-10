# Firebase / Cloud Firestore の初期設定

このアプリは Google ログインと匿名ゲストのどちらも、ユーザーごとに Cloud Firestore を使います。Firebase コンソールで一度だけ次を設定してください。Cloud Storage は使用せず、Spark（無料）プランのまま動作する構成です。

1. **Authentication** → **Sign-in method** で「匿名」を有効化する。
2. 同じ画面で「Google」を有効化し、サポート用メールアドレスを選んで保存する。
3. **Authentication** → **Settings** → **Authorized domains** に `loof-tau.vercel.app` を追加する。独自ドメインを設定した場合は、そのドメインも追加する。
4. **Firestore Database** を作成する（本番モードで可）。
5. `firebase deploy --only firestore:rules` を実行し、リポジトリ内の `firestore.rules` を公開する。

Firestore のルールは次の内容です。

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

各ドキュメントには `updatedAt: serverTimestamp()`、`clientUpdatedAt`、`clientId` を記録します。古い `clientUpdatedAt` の端末からの書き込みは拒否され、削除も tombstone として1件ずつ同期されます。起動時はユーザー別の表示専用キャッシュを先に表示し、最新100件をサーバーで確認するまでは更新操作を受け付けません。キャッシュの配列全体をFirestoreへ書き戻すことはありません。

タイムラインは最新100件が確認できた時点で利用可能になり、残りの履歴と旧データ回復はバックグラウンドで統合します。検索、カレンダー、画像一覧に必要な全履歴はその後自動的に揃います。削除済みtombstoneは表示から除外しますが、「今回の一覧に無い」投稿を削除扱いにはしません。

画像は端末上で縮小・圧縮し、投稿JSON内のdata URLとして保存します。1ドキュメントに収まらない投稿は `users/{uid}/{種類}/{id}/revisions/{revision}/chunks` へ200,000文字ずつ分割するため、Firestoreの1MiB上限を超えません。更新時は新しい世代が確定してから旧世代を、削除時は参照中の全チャンクを消すため、使われない画像データが増え続けることも防ぎます。

ゲストもFirebase匿名認証のUIDに紐づけて同じ分割保存を使うため、ブラウザーのlocalStorage容量で画像保存が失敗しません。以前のゲストデータは初回だけFirestoreへ移行します。Firebase Authentication自体へ接続できない場合だけ端末保存へフォールバックします。

過去のバージョンが保存した `users/{uid}/storage/nb.entries` などは個別ドキュメントへ移行します。途中で止まった旧移行もV2リカバリーで再走査し、更新日時の比較によって現行データを巻き戻さず、不足している項目だけを再統合します。旧チャンク形式の投稿も読み込まれます。ブラウザーやPWAのlocalStorage/IndexedDBは移行元にしないため、古い端末のローカル状態でFirestoreを上書きしません。

同期の記録はブラウザーの開発者ツールのConsoleで `[loof sync]` として確認できます。`ENABLE_FIRESTORE_AUDIT_LOGS` を有効にした場合は、実際の更新・削除・古い更新の拒否を `users/{uid}/syncLogs` にも記録できます。

このリポジトリにはService Workerの登録処理はありません。念のため、過去のPWA版が残したService Workerは起動時に解除し、最新のJavaScriptを読み直します。
