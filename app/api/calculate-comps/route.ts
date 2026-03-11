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

    // Basic Validation
    if (!contactId || !address) {
      return NextResponse.json({ error: "Missing contactId or address" }, { status: 400 });
    }

    // 2. Create initial log entry
    const { data: logEntry } = await supabase
      .from('logs')
      .insert({
        contact_id: contactId,
        contact_name: contactName,
        address: address,
        ghl_status: 'pending',
        webhook_data: body,
      })
      .select()
      .single();

    logId = logEntry?.id;

    // 3. Call Gemini API with live Google Search
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

    // 4. Update log with AI output
    if (logId) {
      await supabase.from('logs').update({ ai_output: aiNote }).eq('id', logId);
    }

    // 5. Build GHL payload
    const ghlPayload: any = { body: aiNote };
    if (opportunityId && opportunityId !== "") {
      ghlPayload.associations = [
        { objectId: opportunityId, objectType: "opportunity" }
      ];
    }

    // 6. Post to GoHighLevel
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlPayload),
    });

    const ghlStatus = ghlRes.ok ? 'success' : `failed_${ghlRes.status}`;

    // 7. Update log with GHL status
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