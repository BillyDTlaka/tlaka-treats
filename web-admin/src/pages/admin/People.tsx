import { useState } from 'react'
import { useEmployees, useLeave, useApproveLeave, useRejectLeave } from '../../lib/hooks'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

const EMP_TYPE_COLOR: Record<string, string> = {
  FULL_TIME: '#059669', PART_TIME: '#2563EB', CONTRACT: '#7C3AED', CASUAL: '#D97706',
}

export default function PeoplePage() {
  const [tab, setTab] = useState<'staff' | 'leave'>('staff')
  const { data: employees = [],      isLoading: empLoading,   refetch: refetchEmp }   = useEmployees({ status: 'ACTIVE' })
  const { data: leaveRequests = [],  isLoading: leaveLoading, refetch: refetchLeave } = useLeave({ status: 'PENDING' })
  const approveLeave = useApproveLeave()
  const rejectLeave  = useRejectLeave()

  const onApprove = (lr: any) => {
    const name = `${lr.employee?.user?.firstName || ''} ${lr.employee?.user?.lastName || ''}`.trim()
    if (window.confirm(`Approve leave? ${name} — ${lr.leaveType} (${lr.days} day${lr.days !== 1 ? 's' : ''})`)) {
      approveLeave.mutate(lr.id)
    }
  }

  const onReject = (lr: any) => {
    if (window.confirm('Reject this leave request? This will notify the employee.')) {
      rejectLeave.mutate(lr.id)
    }
  }

  const isLoading = tab === 'staff' ? empLoading : leaveLoading

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>People</p>
          {tab === 'leave' && leaveRequests.length > 0 && (
            <span style={{ background: COLORS.warning, borderRadius: 10, padding: '2px 7px', color: '#fff', fontSize: 12, fontWeight: 800 }}>{leaveRequests.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['staff', 'leave'] as const).map(id => (
            <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {id === 'staff' ? 'Staff' : 'Leave Requests'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div className="scroll-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Staff */}
          {tab === 'staff' && (employees as any[]).map((emp: any) => {
            const name = `${emp.user?.firstName || ''} ${emp.user?.lastName || ''}`.trim() || 'Unknown'
            const tc = EMP_TYPE_COLOR[emp.employmentType] || '#6B7280'
            const rate = emp.hourlyRate ? `R${Number(emp.hourlyRate).toFixed(2)}/hr` : emp.monthlyRate ? `R${Number(emp.monthlyRate).toLocaleString()}/mo` : ''
            return (
              <div key={emp.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.gray100}`, overflow: 'hidden' }}>
                <div className="emp-row">
                  <div className="emp-avatar" style={{ background: tc }}>{name[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{name}</p>
                    <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>{emp.jobTitle}{emp.departmentRel ? ` · ${emp.departmentRel.name}` : ''}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge" style={{ background: tc + '20', color: tc }}>{emp.employmentType.replace('_', ' ')}</span>
                    {rate && <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray700, marginTop: 4 }}>{rate}</p>}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Leave */}
          {tab === 'leave' && ((leaveRequests as any[]).length === 0 ? (
            <p style={{ textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 }}>No pending leave requests 🎉</p>
          ) : (leaveRequests as any[]).map((lr: any) => {
            const name = `${lr.employee?.user?.firstName || ''} ${lr.employee?.user?.lastName || ''}`.trim() || 'Employee'
            return (
              <div key={lr.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.gray100}`, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{name}</p>
                    <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>{lr.leaveType} · {lr.days} day(s)</p>
                    <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 4 }}>{new Date(lr.fromDate).toLocaleDateString('en-ZA')} → {new Date(lr.toDate).toLocaleDateString('en-ZA')}</p>
                    {lr.reason && <p style={{ fontSize: 12, color: COLORS.gray400, fontStyle: 'italic', marginTop: 4 }}>"{lr.reason}"</p>}
                  </div>
                  <span className="badge" style={{ background: COLORS.warning + '20', color: COLORS.warning }}>PENDING</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => onApprove(lr)} style={{ flex: 1, background: COLORS.success, color: '#fff', borderRadius: 12, padding: 12, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>✓ Approve</button>
                  <button onClick={() => onReject(lr)} style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, fontSize: 13, fontWeight: 700, color: COLORS.danger, cursor: 'pointer', background: '#fff' }}>✕ Reject</button>
                </div>
              </div>
            )
          }))}

          {tab === 'staff' && employees.length === 0 && <p style={{ textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 }}>No active employees</p>}
          <div style={{ height: 24 }} />
        </div>
      )}

      <AdminNavBar />
    </div>
  )
}
