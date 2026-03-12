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
  if (!token) throw new Error('No auth token');
  await jwtVerify(token, JWT_SECRET);
}

// GET - fetch all clients
export async function GET() {
  // 1. Auth check
  try {
    await verifyAuth();
  } catch (err: any) {
    console.error('GET /api/clients auth error:', err.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch clients
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, location_id, ghl_access_token, batchdialer_api_key, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/clients supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients });
  } catch (err: any) {
    console.error('GET /api/clients unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - add new client
export async function POST(req: Request) {
  try {
    await verifyAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, ghl_access_token, location_id, batchdialer_api_key } = await req.json();

    if (!name || !location_id) {
      return NextResponse.json({ error: 'name and location_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        name,
        ghl_access_token: ghl_access_token || '',
        location_id,
        batchdialer_api_key: batchdialer_api_key || null,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/clients supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - update client
export async function PATCH(req: Request) {
  try {
    await verifyAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Strip any stale fields that no longer exist on the table
    delete updates.pipeline_id;

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PATCH /api/clients supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - remove client
export async function DELETE(req: Request) {
  try {
    await verifyAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      console.error('DELETE /api/clients supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}