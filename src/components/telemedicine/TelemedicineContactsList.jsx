import { useState, useEffect } from 'react';

export default function TelemedicineContactsList({
  contacts,
  selectedContact,
  setSelectedContact,
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
  unreadCounts = {}
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !searchTerm || (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'patients') return c.role === 'patient' || c.chatType === 'patient';
    if (activeFilter === 'doctors') return c.role === 'doctor' || c.role === 'nurse' || c.chatType === 'assigned_doctor';
    return true;
  });

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '320px',
      borderRight: '1px solid var(--glass-border)',
      height: '100%',
      flexShrink: 0
    }}>
      {/* Header & Search */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          💬 Telemedicina & Chat
        </h3>
        
        <input
          type="text"
          placeholder="🔍 Buscar contato..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            fontSize: '12.5px',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
        />

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'patients', label: 'Pacientes' },
            { id: 'doctors', label: 'Profissionais' }
          ].map(filter => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '50px',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-color)',
                  background: isActive ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'var(--bg-primary)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 2px 10px rgba(16, 185, 129, 0.35)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contacts List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {filteredContacts.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Nenhum contato encontrado.
          </div>
        ) : (
          filteredContacts.map(contact => {
            const isSelected = selectedContact?.id === contact.id;
            const unread = unreadCounts[contact.id] || 0;

            return (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  cursor: 'pointer',
                  borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent',
                  boxShadow: isSelected ? 'inset 0 0 12px rgba(16, 185, 129, 0.08)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Avatar */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.15)',
                    color: isSelected ? '#10b981' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '16px',
                    boxShadow: isSelected ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                  }}>
                    {contact.name ? contact.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  {(contact.isOnline || (contact.lastSeenAt && (now - new Date(contact.lastSeenAt).getTime()) < 35000)) && (
                    <span style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      border: '2px solid var(--bg-secondary)',
                      boxShadow: '0 0 6px #10b981'
                    }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contact.name || 'Usuário'}
                    </h4>
                    {unread > 0 && (
                      <span style={{
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '50px',
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                      }}>
                        {unread}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {contact.role === 'doctor' ? '👨‍⚕️ Médico' : (contact.role === 'nurse' ? '🩺 Enfermeiro' : '👤 Paciente')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
