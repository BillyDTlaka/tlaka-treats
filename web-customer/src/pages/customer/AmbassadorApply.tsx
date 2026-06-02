import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ambassadorsApi } from '../../services/api'
import api from '../../services/api'

const ID_TYPES     = ['SA ID', 'Passport', "Driver's Licence"]
const BANKS        = ['ABSA', 'Capitec', 'FNB', 'Nedbank', 'Standard Bank', 'TymeBank', 'Discovery Bank', 'African Bank', 'Other']
const ACCOUNT_TYPES = ['Cheque / Current', 'Savings', 'Transmission']

interface PickedFile { uri: string; name: string; mimeType: string; isImage: boolean }

export default function AmbassadorApply() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bio, setBio]             = useState('')
  const [phone, setPhone]         = useState('')
  const [address, setAddress]     = useState('')
  const [idType, setIdType]       = useState('')
  const [idNumber, setIdNumber]   = useState('')
  const [idDocument, setIdDocument] = useState<PickedFile | null>(null)
  const [bankName, setBankName]   = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [accountType, setAccountType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    setIdDocument({
      uri: URL.createObjectURL(file),
      name: file.name,
      mimeType: file.type,
      isImage,
    })
  }

  const uploadDocument = async (): Promise<string> => {
    if (!idDocument || !fileInputRef.current?.files?.[0]) throw new Error('No document selected')
    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', fileInputRef.current.files[0])
      const response = await api.post('/uploads/kyc', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return response.data.url as string
    } finally { setUploadingDoc(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bio.trim()) { alert('Please tell us why you want to be an ambassador'); return }
    if (!phone.trim()) { alert('Please enter your contact number'); return }
    if (!address.trim()) { alert('Please enter your physical address'); return }
    if (!idType) { alert('Please select your ID type'); return }
    if (!idNumber.trim()) { alert('Please enter your ID number'); return }
    if (!idDocument) { alert('Please attach a photo or scan of your ID document'); return }
    if (!bankName) { alert('Please select your bank'); return }
    if (!accountName.trim()) { alert('Please enter the account holder name'); return }
    if (!accountNumber.trim()) { alert('Please enter your account number'); return }
    if (!branchCode.trim()) { alert('Please enter your branch code'); return }
    if (!accountType) { alert('Please select your account type'); return }

    setSubmitting(true)
    try {
      let idDocumentUrl: string
      try { idDocumentUrl = await uploadDocument() }
      catch { alert('Could not upload your document. Please try again.'); return }

      await ambassadorsApi.apply({
        bio: bio.trim(), phone: phone.trim(), address: address.trim(),
        idType, idNumber: idNumber.trim(), idDocumentUrl,
        bankName, accountName: accountName.trim(),
        accountNumber: accountNumber.trim(), branchCode: branchCode.trim(), accountType,
      })
      navigate('/customer/ambassador-status', { replace: true })
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  const SectionTitle = ({ children }: { children: string }) => (
    <p style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', marginTop: 24, marginBottom: 4 }}>{children}</p>
  )
  const FieldLabel = ({ children }: { children: string }) => (
    <p style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6, marginTop: 12 }}>{children}</p>
  )

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Ambassador Application</p>
        <div style={{ width: 40 }} />
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 20 }}>
        <div className="intro-banner">
          <span style={{ fontSize: 36, marginBottom: 10 }}>🌟</span>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 8 }}>Become a Tlaka Treats Ambassador</p>
          <p style={{ fontSize: 13, color: '#f5d0d0', textAlign: 'center', lineHeight: 1.6 }}>
            Earn commission on every order placed with your unique code. Fill in the details below and our team will review your application.
          </p>
        </div>

        <SectionTitle>About You</SectionTitle>
        <FieldLabel>Why do you want to be an ambassador? *</FieldLabel>
        <textarea className="form-textarea" style={{ height: 100 }} placeholder="Tell us about yourself…" value={bio} onChange={e => setBio(e.target.value)} />

        <SectionTitle>Contact Details</SectionTitle>
        <FieldLabel>Mobile number *</FieldLabel>
        <input className="form-input" type="tel" placeholder="e.g. 071 234 5678" value={phone} onChange={e => setPhone(e.target.value)} style={{ marginBottom: 4 }} />
        <FieldLabel>Physical address *</FieldLabel>
        <textarea className="form-textarea" style={{ height: 80 }} placeholder="e.g. 12 Rose Street, Soweto, 1804" value={address} onChange={e => setAddress(e.target.value)} />

        <SectionTitle>Identity Verification</SectionTitle>
        <FieldLabel>ID document type *</FieldLabel>
        <div className="chip-row">
          {ID_TYPES.map(t => (
            <button key={t} type="button" className={`chip${idType === t ? ' active' : ''}`} onClick={() => setIdType(t)}>{t}</button>
          ))}
        </div>
        <FieldLabel>ID / Passport number *</FieldLabel>
        <input className="form-input" placeholder="e.g. 9001015009087" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ marginBottom: 12 }} />

        <FieldLabel>Attach your ID document *</FieldLabel>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 1.5 }}>Take a photo, choose from your library, or upload a PDF scan of your ID.</p>
        <div className="picker-row">
          <label className="picker-btn" style={{ cursor: 'pointer' }}>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
            <span style={{ fontSize: 22 }}>📷</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B3A3A', textAlign: 'center' }}>Take Photo</span>
          </label>
          <label className="picker-btn" style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <span style={{ fontSize: 22 }}>🖼️</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B3A3A', textAlign: 'center' }}>Choose Image</span>
          </label>
          <label className="picker-btn" style={{ cursor: 'pointer' }}>
            <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8B3A3A', textAlign: 'center' }}>Upload PDF</span>
          </label>
        </div>

        {idDocument && (
          <div className="doc-preview">
            {idDocument.isImage ? (
              <img src={idDocument.uri} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} alt="ID" />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 8, background: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📄</div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idDocument.name}</p>
              <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{idDocument.mimeType}</p>
            </div>
            <button type="button" onClick={() => setIdDocument(null)} style={{ background: 'none', border: 'none', padding: 8, fontSize: 16, color: '#999', fontWeight: 700, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        <SectionTitle>Banking Details</SectionTitle>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Your commission payments will be sent to this account.</p>

        <FieldLabel>Bank *</FieldLabel>
        <div className="chip-row">
          {BANKS.map(b => (
            <button key={b} type="button" className={`chip${bankName === b ? ' active' : ''}`} onClick={() => setBankName(b)}>{b}</button>
          ))}
        </div>

        <FieldLabel>Account holder name *</FieldLabel>
        <input className="form-input" placeholder="Full name as it appears on your bank account" value={accountName} onChange={e => setAccountName(e.target.value)} style={{ marginBottom: 4 }} />
        <FieldLabel>Account number *</FieldLabel>
        <input className="form-input" type="number" placeholder="e.g. 1234567890" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} style={{ marginBottom: 4 }} />
        <FieldLabel>Branch code *</FieldLabel>
        <input className="form-input" placeholder="e.g. 051001" value={branchCode} onChange={e => setBranchCode(e.target.value)} style={{ marginBottom: 4 }} />
        <FieldLabel>Account type *</FieldLabel>
        <div className="chip-row">
          {ACCOUNT_TYPES.map(t => (
            <button key={t} type="button" className={`chip${accountType === t ? ' active' : ''}`} onClick={() => setAccountType(t)}>{t}</button>
          ))}
        </div>

        <div className="declaration-box" style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, textAlign: 'center' }}>
            By submitting this application I confirm that all information provided is accurate and I agree to the Tlaka Treats Ambassador Terms & Conditions.
          </p>
        </div>

        <button type="submit" className="btn-primary" style={{ marginBottom: 40 }} disabled={submitting || uploadingDoc}>
          {submitting || uploadingDoc ? 'Submitting…' : 'Submit Application'}
        </button>
      </form>
    </div>
  )
}
