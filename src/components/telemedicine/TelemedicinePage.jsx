import Telemedicine from '../Telemedicine';

export default function TelemedicinePage({
  currentUser,
  activeCallSession,
  setActiveCallSession,
  targetContactId,
  setActiveTab,
  onUnreadCountChange
}) {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <Telemedicine
        currentUser={currentUser}
        activeCallSession={activeCallSession}
        setActiveCallSession={setActiveCallSession}
        targetContactId={targetContactId}
        isAppActiveTab={true}
        setAppActiveTab={setActiveTab}
        onUnreadCountChange={onUnreadCountChange}
      />
    </div>
  );
}
