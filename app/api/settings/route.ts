import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new Error('Unauthorized');
  await jwtVerify(token, JWT_SECRET);
}

// GET - fetch setting by key
export async function GET(req: Request) {
  try {
    await verifyAuth();
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key') || 'prompt_template';

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error) throw error;
    return NextResponse.json({ setting: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST - update setting
export async function POST(req: Request) {
  try {
    await verifyAuth();
    const { key, value } = await req.json();

    if (!key || !value) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ setting: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}