import { useState, useRef, useEffect } from 'react'
import { api, BASE_URL } from '../../services/api'
import { getToken } from '../../lib/auth'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

const QUICK_PROMPTS = [
  'How are sales this week?',
  'What stock is running low?',
  "Summarise this month's finances",
  'Which products sell best?',
  'Run a pricing check for flour',
]

export default function BohlaePage() {
  const [convId, setConvId]     = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.chat.createConversation().then((c: any) => setConvId(c.id)).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || !convId || streaming) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content }])
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = getToken()
      const response = await fetch(`${BASE_URL}/chat/conversations/${convId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullText += parsed.text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: fullText }
                  return updated
                })
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Failed to get a response. Please try again.' }
        return updated
      })
    } finally { setStreaming(false) }
  }

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>B</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, color: COLORS.gray900 }}>Bohlale</p>
            <p style={{ fontSize: 11, color: COLORS.gray400 }}>AI Business Assistant</p>
          </div>
        </div>
        <button
          onClick={() => { api.chat.createConversation().then((c: any) => { setConvId(c.id); setMessages([]) }) }}
          style={{ padding: '6px 12px', borderRadius: 10, background: COLORS.gray100, border: 'none', fontSize: 12, fontWeight: 700, color: COLORS.gray600, cursor: 'pointer' }}
        >New</button>
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ paddingBottom: 80 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
            <span style={{ fontSize: 40, marginBottom: 12 }}>✨</span>
            <p style={{ fontSize: 18, fontWeight: 900, color: COLORS.gray900, marginBottom: 6 }}>Ask Bohlale anything</p>
            <p style={{ fontSize: 13, color: COLORS.gray500, marginBottom: 24, textAlign: 'center' }}>Your AI business advisor for Tlaka Treats</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} className="quick-prompt" onClick={() => sendMessage(p)}>{p}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble${msg.role === 'user' ? ' user' : ''}`}>
            {msg.role === 'assistant' && <div className="ai-avatar">B</div>}
            <div className={`bubble-content${msg.role === 'user' ? ' bubble-user' : ' bubble-ai'}`}>
              {msg.content
                ? <p style={{ fontSize: 14, lineHeight: 1.5, color: msg.role === 'user' ? '#fff' : COLORS.gray900 }}>{msg.content}</p>
                : <div className="spinner" style={{ width: 20, height: 20 }} />
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row" style={{ position: 'fixed', bottom: 65, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480 }}>
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your business…"
          rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        />
        <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || streaming} style={{ opacity: (!input.trim() || streaming) ? 0.4 : 1 }}>
          {streaming ? <div className="spinner" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : '↑'}
        </button>
      </div>

      <AdminNavBar />
    </div>
  )
}
