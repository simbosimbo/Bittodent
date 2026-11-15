// Registry of in-progress forms. Mode switch autosaves clinical drafts; other forms ask before leaving.
import { useEffect } from 'react'

export type UnsavedKind = 'clinical' | 'form'
export type UnsavedEntry = { id: string; kind: UnsavedKind; hasChanges: () => boolean; save?: () => Promise<void>; discard?: () => void }

const entries = new Map<string, UnsavedEntry>()

export function registerUnsaved(entry: UnsavedEntry): () => void {
  entries.set(entry.id, entry)
  return () => { if (entries.get(entry.id) === entry) entries.delete(entry.id) }
}

export function unsavedOf(kind?: UnsavedKind): UnsavedEntry[] {
  return [...entries.values()].filter((e) => e.hasChanges() && (!kind || e.kind === kind))
}

/** Autosave clinical drafts. Returns 'confirm' when a non-clinical form is dirty. */
export async function prepareModeSwitch(): Promise<'ok' | 'confirm'> {
  for (const e of unsavedOf('clinical')) await e.save?.()
  return unsavedOf('form').length ? 'confirm' : 'ok'
}

export async function saveFormsAndContinue(): Promise<void> {
  for (const e of unsavedOf()) await e.save?.()
}

export function discardForms(): void {
  for (const e of unsavedOf('form')) e.discard?.()
}

export function useUnsaved(entry: UnsavedEntry) {
  const { id, kind, hasChanges, save, discard } = entry
  useEffect(() => registerUnsaved({ id, kind, hasChanges, save, discard }), [id, kind, hasChanges, save, discard])
}
