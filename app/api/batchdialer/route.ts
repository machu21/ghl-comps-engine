import { GoogleGenAI } from "@google/genai";
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const maxDuration = 60;

const DEFAULT_PROMPT = `You are a real estate wholesale analyst.
Search for 3 recently SOLD comps within 1 mile of: {{address}}

Return ONLY this:

Property Address: {{address}}
AvgPPS: $X/sqft
ARV: $X
Repairs: $10,000 (medium)
MAO (ARV x 70% - $10,000 repairs): $X
Offer: $X

Profit 5K: $X | Profit 10K: $X | Profit 15K: $X

Comp 1: [Address] | Sold: $X | $/sqft: $X | [X] miles away
Comp 2: [Address] | Sold: $X | $/sqft: $X | [X] miles away
Comp 3: [Address] | Sold: $X | $/sqft: $X | [X] miles away

Analysis: [2 sentences max - good deal or not?]`;

async function getFirstStageId(ghlToken: string, pipelineId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/pipelines/${pipelineId}`,
      { headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28' } }
    );
    const data = await res.json();
    const stages = data.pipeline?.stages || data.stages || [];
    const firstStage = stages.sort((a: any, b: any) => a.position - b.position)[0];
    return firstStage?.id || null;
  } catch (err) {
    console.error('Failed to fetch pipeline stages:', err);
    return null;
  }
}

async function upsertContact(ghlToken: string, contactData: any): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?number=${encodeURIComponent(contactData.phone)}`,
      { headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28' } }
    );
    const searchData = await searchRes.json();
    if (searchData.contact?.id) return searchData.contact.id;

    const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        phone: contactData.phone,
        email: contactData.email || '',
        address1: contactData.address1 || '',
        city: contactData.city || '',
        state: contactData.state || '',
        postalCode: contactData.postalCode || '',
        tags: ['cold lead', 'batchdialer'],
        source: 'BatchDialer',
      }),
    });
    const createData = await createRes.json();
    return createData.contact?.id || null;
  } catch (err) {
    console.error('Failed to upsert contact:', err);
    return null;
  }
}

async function createOpportunity(
  ghlToken: string, contactId: string, contactName: string,
  pipelineId: string, stageId: string, locationId: string, address: string
): Promise<string | null> {
  try {
    const res = await fetch('https://services.leadconnectorhq.com/opportunities/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipelineId, locationId,
        name: `${contactName} - ${address}`,
        pipelineStageId: stageId,
        status: 'open',
        contactId,
        source: 'BatchDialer',
      }),
    });
    const data = await res.json();
    return data.opportunity?.id || null;
  } catch (err) {
    console.error('Failed to create opportunity:', err);
    return null;
  }
}

async function sendNotification(ghlToken: string, locationId: string, contactName: string, address: string, pipelineName: string): Promise<void> {
  try {
    await fetch('https://services.leadconnectorhq.com/notifications/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        title: `🏠 New Lead → ${pipelineName}`,
        body: `${contactName} — ${address} added to ${pipelineName} pipeline.`,
        type: 'info',
      }),
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

export async function POST(req: Request) {
  let logId = '';

  try {
    const body = await req.json();
    console.log("BATCHDIALER WEBHOOK:", JSON.stringify(body));

    // 1. Verify BD API key
    const incomingApiKey =
      req.headers.get('x-batchdialer-api-key') ||
      req.headers.get('x-api-key') ||
      body.api_key ||
      body.apiKey ||
      null;

    if (!incomingApiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    // 2. Lookup client by batchdialer_api_key
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('batchdialer_api_key', incomingApiKey)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Invalid API key — no client matched' }, { status: 401 });
    }

    if (!client.ghl_access_token) {
      return NextResponse.json({ error: 'Client has no GHL token configured' }, { status: 400 });
    }

    // 3. Get default pipeline for this client
    const { data: defaultPipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('client_id', client.id)
      .eq('is_default', true)
      .single();

    if (pipelineError || !defaultPipeline) {
      return NextResponse.json({ error: `No default pipeline set for client "${client.name}". Please set a default pipeline in the dashboard.` }, { status: 400 });
    }

    const ghlToken = client.ghl_access_token;
    const locationId = client.location_id;
    const pipelineId = defaultPipeline.pipeline_id;
    const pipelineName = defaultPipeline.name;

    console.log(`Client: ${client.name} → Pipeline: ${pipelineName} (${pipelineId})`);

    // 4. Extract contact info
    const firstName = body.first_name || body.firstName || body.contact?.firstName || '';
    const lastName = body.last_name || body.lastName || body.contact?.lastName || '';
    const contactName = body.full_name || body.contact?.name || `${firstName} ${lastName}`.trim();
    const phone = body.phone || body.contact?.phone || '';
    const email = body.email || body.contact?.email || '';
    const address = body.address || body.full_address ||
      `${body.address1 || body.contact?.address1 || ''}, ${body.city || body.contact?.city || ''} ${body.state || body.contact?.state || ''}`.trim().replace(/^,\s*/, '');

    if (!address || address.length < 5) {
      return NextResponse.json({ error: 'Missing or invalid address' }, { status: 400 });
    }

    // 5. Create initial log
    const { data: logEntry } = await supabase
      .from('logs')
      .insert({
        contact_id: 'pending',
        contact_name: contactName,
        address,
        ghl_status: 'pending',
        webhook_data: body,
        client_id: client.id,
        location_id: locationId,
      })
      .select()
      .single();
    logId = logEntry?.id;

    // 6. Upsert contact in GHL
    const ghlContactId = await upsertContact(ghlToken, {
      firstName, lastName, phone, email,
      address1: body.address1 || body.contact?.address1,
      city: body.city || body.contact?.city,
      state: body.state || body.contact?.state,
      postalCode: body.postal_code || body.contact?.postalCode,
    });

    if (!ghlContactId) throw new Error('Failed to create/find contact in GHL');

    if (logId) {
      await supabase.from('logs').update({ contact_id: ghlContactId }).eq('id', logId);
    }

    // 7. Get first stage of default pipeline
    const stageId = await getFirstStageId(ghlToken, pipelineId);
    if (!stageId) throw new Error('Failed to fetch pipeline stage ID');

    // 8. Create opportunity in default pipeline
    const opportunityId = await createOpportunity(
      ghlToken, ghlContactId, contactName,
      pipelineId, stageId, locationId, address
    );

    // 9. Fetch prompt template
    const { data: promptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'prompt_template')
      .single();

    const prompt = (promptSetting?.value || DEFAULT_PROMPT).replace(/{{address}}/g, address);

    // 10. Run AI comps
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const aiNote = response.text;

    if (logId) {
      await supabase.from('logs').update({ ai_output: aiNote }).eq('id', logId);
    }

    // 11. Post AI note to GHL contact
    const noteRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${ghlContactId}/notes`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ghlToken}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: aiNote }),
      }
    );
    if (!noteRes.ok) console.error('Note post error:', await noteRes.text());

    // 12. GHL in-app notification
    await sendNotification(ghlToken, locationId, contactName, address, pipelineName);

    // 13. Final log
    if (logId) {
      await supabase.from('logs').update({ ghl_status: 'success' }).eq('id', logId);
    }

    return NextResponse.json({ success: true, contactId: ghlContactId, opportunityId, pipeline: pipelineName });

  } catch (error: any) {
    console.error('BatchDialer Route Error:', error.message);
    if (logId) {
      await supabase.from('logs').update({ ghl_status: `error: ${error.message}` }).eq('id', logId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}