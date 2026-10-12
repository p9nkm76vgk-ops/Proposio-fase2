// Cabecera: marca, contador mensual y acciones principales.

import { BrandMark } from './BrandMark.jsx'
import { CopyIcon, DownloadIcon, FileIcon, SparkIcon, Spinner } from './Icons.jsx'

export function UsageMeter({ usage }) {
  const percent = Math.min(100, (usage.used / usage.limit) * 100)
  const full = usage.used >= usage.limit
  return (
    <div className="usage" title="Contador provisional guardado solo en este navegador">
      <div className="usage__text">
        <span className="usage__plan">Plan gratuito</span>
        <span>
          <strong>{usage.used}</strong> de {usage.limit} propuestas este mes
        </span>
      </div>
      <div
        className={`usage__bar ${full ? 'usage__bar--full' : ''}`}
        role="progressbar"
        aria-label="Propuestas descargadas este mes"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/** Botón secundario: en pantallas pequeñas muestra solo el icono (con nombre accesible). */
function HeaderButton({ icon, label, onClick }) {
  return (
    <button type="button" className="button button--ghost header-button" onClick={onClick} aria-label={label} title={label}>
      {icon}
      <span className="header-button__label" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}

export function AppHeader({ usage, onNew, onDuplicate, onSample, onExport, exporting }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="brand">
          <BrandMark size={34} />
          <span className="brand__name">proposio</span>
        </div>

        <UsageMeter usage={usage} />

        <div className="app-header__actions">
          <HeaderButton icon={<SparkIcon />} label="Ejemplo" onClick={onSample} />
          <HeaderButton icon={<CopyIcon />} label="Duplicar" onClick={onDuplicate} />
          <HeaderButton icon={<FileIcon />} label="Nueva" onClick={onNew} />
          <button
            type="button"
            className="button button--primary"
            onClick={onExport}
            disabled={exporting}
            aria-busy={exporting ? 'true' : undefined}
          >
            {exporting ? <Spinner /> : <DownloadIcon />}
            <span>
              {exporting ? 'Generando…' : (
                <>
                  <span className="hide-sm">Descargar </span>PDF
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
