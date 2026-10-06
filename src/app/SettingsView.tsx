import { useRef } from 'react'
import { exportBackup, importBackup } from '../db'
import type { BackupPayload } from '../types'
import { today } from './utils'

export function SettingsView({ flash, installApp }: { flash: (m: string) => void; installApp?: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function downloadBackup() {
    const payload = await exportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'MaquinesSurMall_backup_' + today() + '.json'
    a.click()
    URL.revokeObjectURL(url)
    flash('Copia de seguridad exportada.')
  }

  async function restore(file?: File) {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload
      const ok = window.confirm('Restaurar esta copia sustituirá TODOS los datos locales actuales. ¿Continuar?')
      if (!ok) return
      await importBackup(payload)
      flash('Copia restaurada correctamente.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo restaurar la copia.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-title"><div><h2>Datos y privacidad</h2><p>Configuración local-first</p></div></div>
        <div className="security-card"><span className="security-icon">✓</span><div><strong>Sin base de datos en la nube</strong><p>Bares, máquinas, averías y recaudaciones se guardan en IndexedDB dentro del perfil de este navegador.</p></div></div>
        <div className="warning-card"><strong>Importante</strong><p>Si borras los datos del navegador, cambias de dispositivo o eliminas el perfil, puedes perder la base local. Exporta copias periódicamente.</p></div>
      </div>
      <div className="panel">
        <div className="panel-title"><div><h2>Aplicación móvil</h2><p>Instálala en el teléfono como una app normal</p></div></div>
        {installApp ? <button className="primary wide" onClick={installApp}>Instalar Maquines Sur</button> : <div className="local-note"><strong>Instalación</strong><p>Si todavía no está instalada, abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.</p></div>}
        <div className="panel-title backup-title"><div><h2>Copias de seguridad</h2><p>El archivo lo controlas tú</p></div></div>
        <button className="primary wide" onClick={downloadBackup}>Exportar copia JSON</button>
        <button className="secondary wide" onClick={() => inputRef.current?.click()}>Restaurar copia</button>
        <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={(e) => restore(e.target.files?.[0])} />
        <p className="muted">No guardes las copias dentro de la carpeta del repositorio Git.</p>
      </div>
    </section>
  )
}
