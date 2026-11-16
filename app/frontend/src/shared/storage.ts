/** localStorage that never throws (private mode, quota, storage disabled): a failed read is null, a failed write is dropped. */
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value) } catch { /* not remembered; callers fall back to their default */ }
  },
}
