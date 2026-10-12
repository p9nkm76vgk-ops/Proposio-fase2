// Borrador de la propuesta actual, guardado solo en este navegador.
// No se envía a ningún servidor.

import { normalizeProposal } from './proposal.js'
import { readJSON, writeJSON } from './storage.js'

const DRAFT_KEY = 'proposio.draft.v1'

export function loadDraft() {
  return normalizeProposal(readJSON(DRAFT_KEY))
}

export function saveDraft(proposal) {
  return writeJSON(DRAFT_KEY, proposal)
}
