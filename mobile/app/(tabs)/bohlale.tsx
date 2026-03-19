import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { COLORS, BRAND } from '../../lib/theme';

const QUICK_PROMPTS = [
  'How are sales this week?',
  'What stock is running low?',
  "Summarise this month's finances",
  'Which products sell best?',
  'Run a pricing check for flour',
];

export default function BohlaleScreen() {
  const [convId, setConvId]     = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Create a new conversation on mount
    api.chat.createConversation().then((c: any) => setConvId(c.id)).catch(() => {});
  }, []);

  async function sendMessage(text?: string) {
    const content = (text || input).trim();
    if (!content || !convId || streaming) return;
    setInput('');

    const userMsg = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    // Add a placeholder for assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/chat/conversations/${convId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullText };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Failed to get a response. Please try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>B</Text>
            </View>
            <View>
              <Text style={styles.title}>Bohlale</Text>
              <Text style={styles.subtitle}>AI Business Assistant</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              api.chat.createConversation().then((c: any) => { setConvId(c.id); setMessages([]); });
            }}
            style={styles.newBtn}
          >
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>Ask Bohlale anything</Text>
              <Text style={styles.emptySub}>Your AI business advisor for Tlaka Treats</Text>
              <View style={styles.quickPrompts}>
                {QUICK_PROMPTS.map((p, i) => (
                  <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(p)}>
                    <Text style={styles.quickBtnText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((msg, i) => (
            <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {msg.role === 'assistant' && (
                <View style={styles.aiAvatar}><Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>B</Text></View>
              )}
              <View style={[styles.bubbleContent, msg.role === 'user' ? styles.userContent : styles.aiContent]}>
                {msg.content
                  ? <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.aiText]}>{msg.content}</Text>
                  : <ActivityIndicator size="small" color={BRAND} />
                }
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about your business…"
            placeholderTextColor={COLORS.gray400}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || streaming) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || streaming}
          >
            {streaming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLORS.gray50 },
  flex:           { flex: 1 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontWeight: '900', fontSize: 14 },
  title:          { fontSize: 16, fontWeight: '900', color: COLORS.gray900 },
  subtitle:       { fontSize: 11, color: COLORS.gray400 },
  newBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: COLORS.gray100 },
  newBtnText:     { fontSize: 12, fontWeight: '700', color: COLORS.gray600 },
  messages:       { flex: 1 },
  messagesContent:{ padding: 16, gap: 12 },
  emptyState:     { alignItems: 'center', paddingTop: 40 },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '900', color: COLORS.gray900, marginBottom: 6 },
  emptySub:       { fontSize: 13, color: COLORS.gray500, marginBottom: 24 },
  quickPrompts:   { gap: 8, width: '100%' },
  quickBtn:       { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  quickBtnText:   { fontSize: 13, color: COLORS.gray700, fontWeight: '600' },
  bubble:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userBubble:     { justifyContent: 'flex-end' },
  aiBubble:       { justifyContent: 'flex-start' },
  aiAvatar:       { width: 24, height: 24, borderRadius: 12, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  bubbleContent:  { maxWidth: '80%', borderRadius: 18, padding: 12 },
  userContent:    { backgroundColor: BRAND, borderBottomRightRadius: 4 },
  aiContent:      { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray100, borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 14, lineHeight: 20 },
  userText:       { color: '#fff' },
  aiText:         { color: COLORS.gray900 },
  inputRow:       { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  input:          { flex: 1, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, maxHeight: 100, backgroundColor: COLORS.gray50 },
  sendBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendBtnDisabled:{ opacity: 0.4 },
  sendBtnText:    { color: '#fff', fontSize: 18, fontWeight: '900' },
});
