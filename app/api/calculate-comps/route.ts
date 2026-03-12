import { GoogleGenAI } from "@google/genai";
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const maxDuration = 60;

export async function POST(req: Request) {
  let logId = '';

  try {
    // 1. Parse the Body ONCE
    const body = await req.json();
    console.log("RAW WEBHOOK DATA:", JSON.stringify(body));

    const { contactId, address, opportunityId } = body.customData || {};
    const contactName = body.full_name || `${body.first_name || ''} ${body.last_name || ''}`.trim();
    const locationId = body.location?.id;
    const locationName = body.location?.name || 'Unknown Client';

    // Basic Validation
    if (!contactId || !address) {
      return NextResponse.json({ error: "Missing contactId or address" }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ error: "Missing location.id in webhook" }, { status: 400 });
    }

    // 2. Lookup client by location_id
    let { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('location_id', locationId)
      .single();

    // 3. Auto-register client if not found
    if (clientError || !client) {
      console.log(`Client not found for location_id: ${locationId}. Auto-registering...`);

      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          name: locationName,
          location_id: locationId,
          ghl_access_token: '', // empty until manually set in dashboard
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to auto-register client:", insertError);
      } else {
        client = newClient;
        console.log(`Auto-registered new client: ${locationName} (${locationId})`);
      }
    }

    console.log("Client:", client?.name || 'unknown');

    // 4. Create initial log entry
    const { data: logEntry } = await supabase
      .from('logs')
      .insert({
        contact_id: contactId,
        contact_name: contactName,
        address: address,
        ghl_status: 'pending',
        webhook_data: body,
        client_id: client?.id || null,
        location_id: locationId,
      })
      .select()
      .single();

    logId = logEntry?.id;

    // 5. Call Gemini API with live Google Search
    const prompt = `
      You are a real estate wholesale analyst.
      Search for 3 recently SOLD comps within 1 mile of: ${address}

      Return ONLY this:

      Property Address: ${address}
      AvgPPS: $X/sqft
      ARV: $X
      Repairs: $10,000 (medium)
      MAO (ARV x 70% - $10,000 repairs): $X
      Offer: $X

      Profit 5K: $X | Profit 10K: $X | Profit 15K: $X

      Comp 1: [Address] | Sold: $X | $/sqft: $X | [X] miles away
      Comp 2: [Address] | Sold: $X | $/sqft: $X | [X] miles away
      Comp 3: [Address] | Sold: $X | $/sqft: $X | [X] miles away

      Analysis: [2 sentences max - good deal or not?]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const aiNote = response.text;

    // 6. Update log with AI output
    if (logId) {
      await supabase.from('logs').update({ ai_output: aiNote }).eq('id', logId);
    }

    // 7. Check if client has a GHL token before posting
    if (!client?.ghl_access_token) {
      console.warn(`Client ${client?.name} has no GHL token. Skipping GHL note post.`);
      if (logId) {
        await supabase.from('logs').update({
          ghl_status: 'missing_ghl_token'
        }).eq('id', logId);
      }
      return NextResponse.json({
        success: true,
        warning: `Client auto-registered but has no GHL token yet. Add it in the dashboard.`
      });
    }

    // 8. Build GHL payload using client's token
    const ghlPayload: any = { body: aiNote };
    if (opportunityId && opportunityId !== "") {
      ghlPayload.associations = [
        { objectId: opportunityId, objectType: "opportunity" }
      ];
    }

    // 9. Post to GoHighLevel using client's GHL token
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.ghl_access_token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlPayload),
    });

    const ghlStatus = ghlRes.ok ? 'success' : `failed_${ghlRes.status}`;

    // 10. Update log with GHL status
    if (logId) {
      await supabase.from('logs').update({ ghl_status: ghlStatus }).eq('id', logId);
    }

    if (!ghlRes.ok) {
      const errorData = await ghlRes.text();
      console.error("GHL Error Details:", errorData);
      throw new Error(`GHL API Update Failed: ${ghlRes.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Route Error:", error.message);
    if (logId) {
      await supabase.from('logs').update({ ghl_status: `error: ${error.message}` }).eq('id', logId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}