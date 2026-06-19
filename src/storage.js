import { Capacitor, registerPlugin } from "@capacitor/core";

const localStorageAdapter = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value == null ? null : { value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
  async delete(key) {
    window.localStorage.removeItem(key);
  }
};

const LoofCloud = registerPlugin("LoofCloud");

async function createNativeStorageAdapter() {
  try {
    const status = await LoofCloud.isAvailable();
    if (!status.available) return localStorageAdapter;
  } catch (_) {
    return localStorageAdapter;
  }

  return {
    async get(key) {
      try {
        const result = await LoofCloud.get({ key });
        if (result?.value == null) {
          const local = await localStorageAdapter.get(key);
          if (local?.value != null) await LoofCloud.set({ key, value: local.value });
          return local;
        }
        return { value: result.value };
      } catch (_) {
        return localStorageAdapter.get(key);
      }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      try {
        await LoofCloud.set({ key, value });
      } catch (_) {}
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
      try {
        await LoofCloud.delete({ key });
      } catch (_) {}
    }
  };
}

if (typeof window !== "undefined" && !window.storage) {
  const adapterPromise = Capacitor.isNativePlatform()
    ? createNativeStorageAdapter()
    : Promise.resolve(localStorageAdapter);

  window.storage = {
    async get(key) {
      const adapter = await adapterPromise;
      return adapter.get(key);
    },
    async set(key, value) {
      const adapter = await adapterPromise;
      return adapter.set(key, value);
    },
    async delete(key) {
      const adapter = await adapterPromise;
      return adapter.delete(key);
    }
  };
}
