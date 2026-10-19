/** The journal in the browser's localStorage, heard across tabs. */
export function webStorage(key, area = globalThis.localStorage) {
  return {
    read: () => area.getItem(key),
    write: (raw) => area.setItem(key, raw),
    watch(onChange) {
      const changed = (event) => {
        if (event.storageArea !== area) return;
        if (event.key !== key && event.key !== null) return;
        onChange();
      };
      window.addEventListener("storage", changed);
      return () => window.removeEventListener("storage", changed);
    },
  };
}
