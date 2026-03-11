import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  try {
    // 1. Create users table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id uuid default gen_random_uuid() primary key,
          username text unique not null,
          password_hash text not null
        );
      `
    });

    // 2. Hash password
    const password_hash = await bcrypt.hash('admin123', 12);

    // 3. Delete existing admin if any
    await supabase.from('users').delete().eq('username', 'admin');

    // 4. Insert admin user
    const { data, error } = await supabase
      .from('users')
      .insert({ username: 'admin', password_hash })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created! Username: admin, Password: admin123',
      user: { id: data.id, username: data.username }
    });

  } catch (error: any) {
    console.error('Setup error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}