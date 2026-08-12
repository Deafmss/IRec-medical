export default function DoctorPatientsListView({
  filteredPatients,
  selectedPatient,
  setSelectedPatient,
  activeFilter,
  setActiveFilter,
  searchTerm,
  setSearchTerm,
  onOpenChat
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Buscar por nome do paciente, CPF ou lesão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveFilter('my-patients')}
            style={{
              padding: '6px 14px',
              borderRadius: '50px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid var(--border-color)',
              backgroundColor: activeFilter === 'my-patients' ? '#0284c7' : 'var(--bg-primary)',
              color: activeFilter === 'my-patients' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📋 Meus Pacientes ({filteredPatients.length})
          </button>
          <button
            onClick={() => setActiveFilter('infection')}
            style={{
              padding: '6px 14px',
              borderRadius: '50px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid var(--border-color)',
              backgroundColor: activeFilter === 'infection' ? '#ef4444' : 'var(--bg-primary)',
              color: activeFilter === 'infection' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ⚠️ Alertas de Infecção
          </button>
        </div>
      </div>

      {/* Patient Cards Grid */}
      {filteredPatients.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Nenhum paciente encontrado com os filtros informados.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '16px'
        }}>
          {filteredPatients.map((patient) => {
            const isSelected = selectedPatient?.id === patient.id;
            return (
              <div
                key={patient.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isSelected ? '2px solid #0284c7' : '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isSelected ? '0 4px 16px rgba(2, 132, 199, 0.15)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
              >
                {/* Patient Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(2, 132, 199, 0.12)',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '800'
                    }}>
                      {patient.name ? patient.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                        {patient.name || 'Paciente'}
                      </h4>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        CPF: {patient.cpf || 'Não informado'} • {patient.gender || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '50px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>
                    🩺 {patient.lesionType || 'Sem lesão registrada'}
                  </span>
                  {patient.hasInfectionSigns && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '50px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      fontWeight: '800'
                    }}>
                      ⚠️ Alerta de Infecção
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedPatient(patient)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#0284c7'
                    }}
                  >
                    📋 Ver Prontuário
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onOpenChat && onOpenChat(patient.id)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      borderRadius: '8px'
                    }}
                    title="Telemedicina"
                  >
                    📹
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
