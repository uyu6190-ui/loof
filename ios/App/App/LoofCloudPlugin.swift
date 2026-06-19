import Capacitor
import CloudKit
import Foundation

@objc(LoofCloudPlugin)
public class LoofCloudPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LoofCloudPlugin"
    public let jsName = "LoofCloud"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise)
    ]

    private let recordType = "LoofKV"
    private var database: CKDatabase {
        CKContainer(identifier: containerIdentifier).privateCloudDatabase
    }
    private var containerIdentifier: String {
        getConfig().getString("containerIdentifier", "iCloud.com.uyu6190.loof") ?? "iCloud.com.uyu6190.loof"
    }

    @objc public func isAvailable(_ call: CAPPluginCall) {
        CKContainer(identifier: containerIdentifier).accountStatus { status, error in
            if let error = error {
                call.resolve(["available": false, "status": "error", "message": error.localizedDescription])
                return
            }

            switch status {
            case .available:
                call.resolve(["available": true, "status": "available"])
            case .noAccount:
                call.resolve(["available": false, "status": "noAccount"])
            case .restricted:
                call.resolve(["available": false, "status": "restricted"])
            case .couldNotDetermine:
                call.resolve(["available": false, "status": "couldNotDetermine"])
            case .temporarilyUnavailable:
                call.resolve(["available": false, "status": "temporarilyUnavailable"])
            @unknown default:
                call.resolve(["available": false, "status": "unknown"])
            }
        }
    }

    @objc public func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key")
            return
        }

        database.fetch(withRecordID: recordID(for: key)) { record, error in
            if let ckError = error as? CKError, ckError.code == .unknownItem {
                call.resolve(["value": NSNull()])
                return
            }

            if let error = error {
                call.reject(error.localizedDescription)
                return
            }

            if let value = record?["value"] as? String {
                call.resolve(["value": value])
            } else {
                call.resolve(["value": NSNull()])
            }
        }
    }

    @objc public func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key")
            return
        }
        guard let value = call.getString("value") else {
            call.reject("Missing value")
            return
        }

        let id = recordID(for: key)
        database.fetch(withRecordID: id) { [weak self] fetchedRecord, error in
            guard let self else { return }

            if let ckError = error as? CKError, ckError.code != .unknownItem {
                call.reject(ckError.localizedDescription)
                return
            }

            let record = fetchedRecord ?? CKRecord(recordType: self.recordType, recordID: id)
            record["key"] = key as CKRecordValue
            record["value"] = value as CKRecordValue
            record["updatedAt"] = Date() as CKRecordValue

            self.database.save(record) { _, saveError in
                if let saveError = saveError {
                    call.reject(saveError.localizedDescription)
                    return
                }
                call.resolve()
            }
        }
    }

    @objc public func delete(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Missing key")
            return
        }

        database.delete(withRecordID: recordID(for: key)) { _, error in
            if let ckError = error as? CKError, ckError.code == .unknownItem {
                call.resolve()
                return
            }

            if let error = error {
                call.reject(error.localizedDescription)
                return
            }

            call.resolve()
        }
    }

    private func recordID(for key: String) -> CKRecord.ID {
        let data = Data(key.utf8)
        let encoded = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return CKRecord.ID(recordName: "kv_\(encoded)")
    }
}
