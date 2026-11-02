import { NextRequest, NextResponse } from 'next/server';
import { generateKashierOrderHash, getKashierMerchantId } from '@/lib/kashierBackend';

/**
 * Next.js App Router Route: POST /api/kashier/hash
 * يولد التوقيع الرقمي HMAC-SHA256 المطلوب لعملية الدفع بشكل آمن على السيرفر
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, currency, merchantId } = body || {};

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing required field: orderId' },
        { status: 400 }
      );
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Missing required field: amount' },
        { status: 400 }
      );
    }

    const hashResult = generateKashierOrderHash({
      orderId,
      amount,
      currency: currency || 'EGP',
      merchantId: merchantId || getKashierMerchantId(),
    });

    return NextResponse.json({
      success: true,
      ...hashResult,
    });
  } catch (error: any) {
    console.error('[API /api/kashier/hash] Error generating hash:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate Kashier payment hash' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Kashier Hash Generator API is active. Send POST with orderId, amount, currency.' },
    { status: 200 }
  );
}
