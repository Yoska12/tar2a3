import crypto from 'crypto';
import { QuizSessionPayload } from '../types/quiz.types';

const SECRET_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.JWT_SECRET || 
  'tarqa_qudrat_secure_session_secret_2026';

// توليد توكن جلسة اختبار مشفر وموقع رقمياً (Cryptographically Signed Session Token)
export function createQuizSessionToken(payload: QuizSessionPayload): string {
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf8').toString('base64url');
  
  const hmac = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(base64Data)
    .digest('base64url');

  return `${base64Data}.${hmac}`;
}

// فك تشفير وتأكيد صحة توكن الجلسة ومنع أي تلاعب بالبيانات أو بالزمن
export function verifyQuizSessionToken(token: string): QuizSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [base64Data, expectedHmac] = parts;
    const computedHmac = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(base64Data)
      .digest('base64url');

    // مقارنة ثابتة التوقيت لمنع هجمات التوقيت (Timing-safe comparison)
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(expectedHmac, 'utf8'),
      Buffer.from(computedHmac, 'utf8')
    );

    if (!isSignatureValid) return null;

    const rawJson = Buffer.from(base64Data, 'base64url').toString('utf8');
    const payload = JSON.parse(rawJson) as QuizSessionPayload;

    return payload;
  } catch (err) {
    console.error('[QuizToken] Verification failed:', err);
    return null;
  }
}
