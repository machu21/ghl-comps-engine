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

// GET - fetch all clients
export async function GET() {
  try {
    await verifyAuth();
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, location_id, ghl_access_token, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ clients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST - add new client
export async function POST(req: Request) {
  try {
    await verifyAuth();
    const { name, ghl_access_token, location_id } = await req.json();
    if (!name || !ghl_access_token || !location_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('clients')
      .insert({ name, ghl_access_token, location_id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ client: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - remove client
export async function DELETE(req: Request) {
  try {
    await verifyAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}