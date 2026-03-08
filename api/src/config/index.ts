export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  isDev: process.env.NODE_ENV !== 'production',

  // Public URL used in WhatsApp messages / PDF links
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // Email (SMTP — works with Gmail App Password, SendGrid, Mailgun SMTP, etc.)
  email: {
    host:    process.env.SMTP_HOST     || '',
    port:    parseInt(process.env.SMTP_PORT  || '587', 10),
    secure:  process.env.SMTP_SECURE   === 'true',
    user:    process.env.SMTP_USER     || '',
    pass:    process.env.SMTP_PASS     || '',
    from:    process.env.EMAIL_FROM    || 'Tlaka Treats <hello@tlakatreats.co.za>',
  },

  // WhatsApp via Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID  || '',
    authToken:  process.env.TWILIO_AUTH_TOKEN   || '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  },
}
