import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { 
      householdId, 
      targetUserId, 
      excludeUserId, 
      title, 
      body, 
      link = '/', 
      data = {} 
    } = json;

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Missing title or body in request' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const tokens: string[] = [];

    if (targetUserId) {
      // Send to specific user
      const { data: profile } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', targetUserId)
        .single();

      if (profile?.fcm_token) {
        tokens.push(profile.fcm_token);
      }
    } else if (householdId) {
      // Send to all members in household (optionally excluding the sender)
      let query = supabase
        .from('profiles')
        .select('fcm_token, id')
        .eq('household_id', householdId)
        .not('fcm_token', 'is', null);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data: members } = await query;
      if (members) {
        members.forEach((m) => {
          if (m.fcm_token) tokens.push(m.fcm_token);
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Must provide either targetUserId or householdId' },
        { status: 400 }
      );
    }

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No registered FCM device tokens found for target user(s)',
        tokensCount: 0,
      });
    }

    const result = await sendPushNotification({
      tokens,
      title,
      body,
      link,
      data,
    });

    return NextResponse.json({
      success: result.success,
      tokensCount: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      error: result.error,
    });
  } catch (error: unknown) {
    console.error('API /api/notifications/send error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
