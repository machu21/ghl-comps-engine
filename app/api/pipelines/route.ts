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

// GET /api/pipelines?client_id=xxx — get all pipelines for a client
export async function GET(req: Request) {
  try {
    await verifyAuth();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });

    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ pipelines: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST /api/pipelines — add pipeline
export async function POST(req: Request) {
  try {
    await verifyAuth();
    const { client_id, name, pipeline_id, is_default } = await req.json();
    if (!client_id || !name || !pipeline_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If setting as default, clear other defaults for this client first
    if (is_default) {
      await supabase
        .from('pipelines')
        .update({ is_default: false })
        .eq('client_id', client_id);
    }

    const { data, error } = await supabase
      .from('pipelines')
      .insert({ client_id, name, pipeline_id, is_default: is_default || false })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ pipeline: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/pipelines — update (e.g. set as default)
export async function PATCH(req: Request) {
  try {
    await verifyAuth();
    const { id, client_id, is_default, name, pipeline_id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // If setting as default, clear others first
    if (is_default && client_id) {
      await supabase
        .from('pipelines')
        .update({ is_default: false })
        .eq('client_id', client_id);
    }

    const { data, error } = await supabase
      .from('pipelines')
      .update({ is_default, name, pipeline_id })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ pipeline: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/pipelines?id=xxx
export async function DELETE(req: Request) {
  try {
    await verifyAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabase.from('pipelines').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}