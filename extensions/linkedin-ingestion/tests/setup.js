/**
 * Global Test Setup for Chrome Extensions
 * Mocks chrome.storage, chrome.runtime, chrome.tabs APIs for Vitest tests.
 */

const storageState = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys) => {
        return new Promise((resolve) => {
          if (!keys) {
            resolve({ ...storageState });
            return;
          }
          if (typeof keys === 'string') {
            resolve({ [keys]: storageState[keys] });
            return;
          }
          if (Array.isArray(keys)) {
            const res = {};
            keys.forEach(k => { res[k] = storageState[k]; });
            resolve(res);
            return;
          }
          if (typeof keys === 'object') {
            const res = { ...keys };
            Object.keys(keys).forEach(k => {
              if (storageState[k] !== undefined) res[k] = storageState[k];
            });
            resolve(res);
            return;
          }
          resolve({});
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          Object.assign(storageState, items);
          resolve();
        });
      },
      remove: (keys) => {
        return new Promise((resolve) => {
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach(k => delete storageState[k]);
          resolve();
        });
      },
      clear: () => {
        return new Promise((resolve) => {
          Object.keys(storageState).forEach(k => delete storageState[k]);
          resolve();
        });
      }
    }
  },
  runtime: {
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    sendMessage: (msg, cb) => {
      if (cb) cb({ success: true });
    },
    onMessage: {
      addListener: () => {}
    },
    lastError: null
  },
  tabs: {
    query: () => Promise.resolve([{ id: 1, url: 'https://www.linkedin.com/jobs/view/4459466556/' }]),
    sendMessage: (id, msg, cb) => {
      if (cb) cb({ success: true });
    }
  },
  scripting: {
    executeScript: () => Promise.resolve()
  }
};
