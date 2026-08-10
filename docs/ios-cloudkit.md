# iOS CloudKit Setup

loof's iOS app uses Capacitor to run the existing React UI inside a native shell.
The native `LoofCloud` plugin stores app data in the user's private iCloud
database through CloudKit.

## Identifiers

Current placeholders:

- Bundle ID: `com.uyu6190.loof`
- iCloud Container: `iCloud.com.uyu6190.loof`

Change these in all of the following places if the Apple Developer identifiers
are different:

- `capacitor.config.ts`
- `ios/App/App/App.entitlements`
- Xcode target `PRODUCT_BUNDLE_IDENTIFIER`

## Apple Developer Setup

1. Create or select the App ID for `com.uyu6190.loof`.
2. Enable iCloud for the App ID.
3. Enable CloudKit for the iCloud capability.
4. Create the container `iCloud.com.uyu6190.loof`.
5. Attach that container to the App ID.
6. Open `ios/App/App.xcodeproj` in Xcode.
7. Select a signing team and confirm iCloud + CloudKit are enabled.
8. Run on a real device signed into iCloud.

## Local Workflow

```bash
npm run ios:sync
npm run ios:open
```

`ios:sync` builds the Vite app, syncs Capacitor assets, then re-adds the local
`LoofCloudPlugin` registration to `ios/App/App/capacitor.config.json`.

## Data Model

The first CloudKit bridge stores loof's existing persisted keys as records of
type `LoofKV` in the private database.

- `key`: persisted app key, such as `nb.accounts`
- `value`: JSON string
- `updatedAt`: last native write date

Item saves and deletes are serialized through this key-value record. Each
mutation first fetches the latest CloudKit value, changes only the requested
item, and saves the merged array before the UI treats the operation as complete.
Guest/local fallback uses the same item-level merge behavior.

After the first successful sync, launches render the local copy immediately and
refresh the CloudKit value in the background. A first launch with no local copy
still waits for CloudKit so an empty device cannot overwrite existing history.

Images are currently included in the existing JSON as compressed data URLs.
Before App Store scale, consider moving image blocks to CloudKit assets so large
photo-heavy histories sync more efficiently.
