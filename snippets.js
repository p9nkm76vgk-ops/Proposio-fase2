// Textos habituales: condiciones de pago, exclusiones, plazos... que el usuario
// guarda una vez y reutiliza en otras propuestas. Se guardan en este navegador.

import { createId } from './proposal.js'
import { readJSON, writeJSON } from './storage.js'

const SNIPPETS_KEY = 'proposio.snippets.v1'
export const MAX_SNIPPETS_PER_FIELD = 10

/** Campos que admiten textos guardados y su nombre para mostrar. */
export const SNIPPET_FIELDS = {
  service: 'servicio',
  timeline: 'plazos',
  paymentTerms: 'condiciones de pago',
  revisions: 'revisiones',
  exclusions: 'exclusiones',
  nextSteps: 'próximos pasos',
}

function readAll() {
  const raw = readJSON(SNIPPETS_KEY)
  return raw && typeof raw === 'object' ? raw : {}
}

export function loadSnippets(field) {
  const list = readAll()[field]
  if (!Array.isArray(list)) return []
  return list.filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string' && s.text.trim() !== '')
}

function saveField(field, list) {
  const all = readAll()
  all[field] = list
  return writeJSON(SNIPPETS_KEY, all)
}

/** Guarda un texto. Devuelve { ok, list, reason } */
export function addSnippet(field, text) {
  const value = text.trim()
  const list = loadSnippets(field)
  if (!value) return { ok: false, list, reason: 'empty' }
  if (list.some((s) => s.text.trim() === value)) return { ok: false, list, reason: 'duplicate' }
  if (list.length >= MAX_SNIPPETS_PER_FIELD) return { ok: false, list, reason: 'full' }
  const next = [{ id: createId(), text: value }, ...list]
  return saveField(field, next) ? { ok: true, list: next } : { ok: false, list, reason: 'storage' }
}

export function removeSnippet(field, id) {
  const next = loadSnippets(field).filter((s) => s.id !== id)
  saveField(field, next)
  return next
}
