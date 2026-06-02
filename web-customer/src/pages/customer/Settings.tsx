import CustomerNavBar from '../../components/CustomerNavBar'

export default function CustomerSettings() {
  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', padding: '52px 20px 18px', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Settings</p>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 16, color: '#999' }}>Settings coming soon</p>
      </div>
      <CustomerNavBar />
    </div>
  )
}
