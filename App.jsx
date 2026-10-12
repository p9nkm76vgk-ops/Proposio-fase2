// Componente principal: guarda el estado de la propuesta y coordina
// formulario, vista previa, borrador local, límite mensual y exportación a PDF.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from './AppHeader.jsx'
import { Modal, Toast } from './Feedback.jsx'
import { ProposalForm } from './ProposalForm.jsx'
import { ProposalPreview } from './ProposalPreview.jsx'
import { buildDocument } from './document.js'
import { loadDraft, saveDraft } from './drafts.js'
import { downloadProposalPdf } from './pdf.js'
import { loadProfile, saveProfile } from './profile.js'
import { createEmptyProposal, createSampleProposal, duplicateProposal, hasUserContent, setIn } from './proposal.js'
import { getUsage, registerExport } from './usage.js'
import { fieldIdFromPath, validateProposal } from './validation.js'

export default function App() {
  const [proposal, setProposal] = useState(() => loadDraft() ?? createEmptyProposal(loadProfile() ?? {}))
  const [touched, setTouched] = useState(() => new Set())
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [activeTab, setActiveTab] = useState('edit') // solo se usa en móvil
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [dialog, setDialog] = useState(null) // { kind: 'confirm' | 'limit', ... }
  const [usageVersion, setUsageVersion] = useState(0)
  const [draftSaved, setDraftSaved] = useState(true)

  const errors = useMemo(() => validateProposal(proposal), [proposal])
  const model = useMemo(() => buildDocument(proposal), [proposal])
  // usageVersion fuerza a releer el contador después de una descarga.
  const usage = useMemo(() => getUsage(proposal.id), [proposal.id, usageVersion])
  const errorCount = Object.keys(errors).length

  // Guardado automático del borrador (solo en este navegador), con una pequeña espera.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraftSaved(saveDraft(proposal))
      saveProfile(proposal) // tus datos y diseño, para las próximas propuestas
    }, 400)
    return () => clearTimeout(timer)
  }, [proposal])

  const switchTab = (tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0 })
  }

  const closeToast = useCallback(() => setToast(null), [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const handleFieldChange = useCallback((path, value) => {
    setProposal((prev) => setIn(prev, path.split('.'), value))
  }, [])

  const handleBlur = useCallback((path) => {
    setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path)))
  }, [])

  const errorFor = useCallback(
    (path) => (showAllErrors || touched.has(path) ? errors[path] : undefined),
    [errors, showAllErrors, touched],
  )

  const resetWith = (next, message) => {
    setProposal(next)
    setTouched(new Set())
    setShowAllErrors(false)
    setActiveTab('edit')
    setDialog(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setToast({ type: 'success', message })
  }

  const askBeforeReplacing = (title, message, confirmLabel, action) => {
    if (!hasUserContent(proposal)) {
      action()
      return
    }
    setDialog({ kind: 'confirm', title, message, confirmLabel, onConfirm: action })
  }

  const handleNew = () =>
    askBeforeReplacing(
      '¿Empezar una propuesta nueva?',
      'Se borrará el contenido actual del borrador. Se conservarán tus datos (nombre y contacto) y el diseño elegido.',
      'Empezar nueva',
      () =>
        resetWith(
          createEmptyProposal({ professional: proposal.professional, design: proposal.design }),
          'Nueva propuesta lista.',
        ),
    )

  const handleDuplicate = () => {
    if (!hasUserContent(proposal)) {
      setToast({ type: 'error', message: 'No hay nada que duplicar todavía: escribe o carga una propuesta primero.' })
      return
    }
    resetWith(duplicateProposal(proposal), 'Copia creada. Contará como propuesta nueva cuando la descargues.')
  }

  const handleSample = () =>
    askBeforeReplacing(
      '¿Cargar la propuesta de ejemplo?',
      'Se sustituirá el contenido actual del borrador por datos de ejemplo ficticios.',
      'Cargar ejemplo',
      () => resetWith(createSampleProposal({ design: proposal.design }), 'Ejemplo cargado. Edítalo para ver cómo cambia la vista previa.'),
    )

  const focusFirstError = () => {
    const firstPath = Object.keys(errors)[0]
    if (!firstPath) return
    setActiveTab('edit')
    // Espera a que se muestre la pestaña de edición en móvil antes de enfocar.
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldIdFromPath(firstPath))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus({ preventScroll: true })
      }
    })
  }

  const handleExport = async () => {
    if (exporting) return
    if (errorCount > 0) {
      setShowAllErrors(true)
      setToast({
        type: 'error',
        message:
          errorCount === 1
            ? 'Falta 1 dato obligatorio o hay un valor no válido.'
            : `Faltan datos obligatorios o hay valores no válidos (${errorCount}).`,
      })
      focusFirstError()
      return
    }
    if (!usage.canExport) {
      setDialog({ kind: 'limit' })
      return
    }

    setExporting(true)
    try {
      await downloadProposalPdf(proposal)
      const stored = registerExport(proposal.id)
      setUsageVersion((v) => v + 1)
      setToast({
        type: 'success',
        message: stored
          ? 'PDF generado. Revisa tu carpeta de descargas.'
          : 'PDF generado, pero no se pudo guardar el contador en este navegador.',
      })
    } catch (error) {
      console.error('Error al generar el PDF', error)
      setToast({ type: 'error', message: error?.userMessage ?? 'No se pudo generar el PDF. Inténtalo de nuevo.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#editor">
        Saltar al formulario
      </a>

      <AppHeader
        usage={usage}
        onNew={handleNew}
        onDuplicate={handleDuplicate}
        onSample={handleSample}
        onExport={handleExport}
        exporting={exporting}
      />

      <div className="tabs" role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          id="tab-edit"
          aria-selected={activeTab === 'edit'}
          aria-controls="editor"
          className={`tabs__tab ${activeTab === 'edit' ? 'tabs__tab--active' : ''}`}
          onClick={() => switchTab('edit')}
        >
          Editar
          {showAllErrors && errorCount > 0 && <span className="tabs__badge">{errorCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-preview"
          aria-selected={activeTab === 'preview'}
          aria-controls="preview"
          className={`tabs__tab ${activeTab === 'preview' ? 'tabs__tab--active' : ''}`}
          onClick={() => switchTab('preview')}
        >
          Vista previa
        </button>
      </div>

      <main className={`workspace workspace--${activeTab}`}>
        <div className="workspace__editor" id="editor" aria-labelledby="tab-edit">
          <div className="editor-intro">
            <h1>Crea tu propuesta</h1>
            <p>
              Rellena los datos y revisa el resultado en la vista previa. Los campos con * son obligatorios.
              <span className="editor-intro__save" aria-live="polite">
                {draftSaved
                  ? ' El borrador se guarda automáticamente en este navegador.'
                  : ' No se pudo guardar el borrador en este navegador (puede estar en modo privado).'}
              </span>
            </p>
          </div>
          <ProposalForm
            proposal={proposal}
            onFieldChange={handleFieldChange}
            onBlur={handleBlur}
            errorFor={errorFor}
          />
          <div className="editor-footer">
            <button type="button" className="button button--primary button--large" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Generando…' : 'Descargar PDF'}
            </button>
            <p className="editor-footer__note">
              {usage.alreadyCounted
                ? 'Esta propuesta ya se contó este mes: puedes volver a descargarla sin gastar otra.'
                : `Te quedan ${usage.remaining} de ${usage.limit} propuestas este mes. Volver a descargar la misma propuesta no cuenta de nuevo.`}
            </p>
          </div>
        </div>

        <aside className="workspace__preview" id="preview" aria-labelledby="tab-preview">
          <div className="preview-frame">
            <ProposalPreview model={model} />
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <p>
          proposio · Versión de prueba (MVP). Tus datos se quedan en este navegador: no se envían a ningún servidor.
        </p>
      </footer>

      <Toast toast={toast} onClose={closeToast} />

      <Modal
        open={dialog?.kind === 'confirm'}
        title={dialog?.title}
        onClose={closeDialog}
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={closeDialog}>
              Cancelar
            </button>
            <button type="button" className="button button--primary" onClick={() => dialog?.onConfirm()}>
              {dialog?.confirmLabel}
            </button>
          </>
        }
      >
        <p>{dialog?.message}</p>
      </Modal>

      <Modal
        open={dialog?.kind === 'limit'}
        title="Has alcanzado el límite de este mes"
        onClose={closeDialog}
        actions={
          <button type="button" className="button button--primary" onClick={closeDialog}>
            Entendido
          </button>
        }
      >
        <p>
          El plan gratuito permite descargar {usage.limit} propuestas distintas al mes. El contador se reinicia el día 1
          del mes que viene.
        </p>
        <p>
          Puedes seguir editando y volver a descargar cualquiera de las propuestas que ya descargaste este mes. Los
          planes de pago todavía no están disponibles.
        </p>
      </Modal>
    </div>
  )
}
