/** An in-memory storage for tests; `external(raw)` plays another tab writing. */
export function memoryStorage(initial = null) {
  let raw = initial,
    onChange,
    failure = null;
  return {
    read: () => raw,
    write(next) {
      if (failure) {
        const error = failure;
        failure = null;
        throw error;
      }
      raw = next;
    },
    watch(callback) {
      onChange = callback;
      return () => (onChange = undefined);
    },
    external(next) {
      raw = next;
      onChange?.();
    },
    failNextWrite(error) {
      failure = error;
    },
  };
}
