import { GoogleGenAI } from "@google/genai";
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Parse the Body ONCE
    const body = await req.json();
    console.log("RAW WEBHOOK DATA:", JSON.stringify(body));
    const { contactId, address, opportunityId } = body.customData || {};

    // Basic Validation
    if (!contactId || !address) {
      return NextResponse.json({ error: "Missing contactId or address" }, { status: 400 });
    }

    // 2. Call Gemini API with live Google Search
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

    // 3. Build GHL payload — only include associations if opportunityId exists
    const ghlPayload: any = { body: aiNote };
    if (opportunityId && opportunityId !== "") {
      ghlPayload.associations = [
        {
          objectId: opportunityId,
          objectType: "opportunity"
        }
      ];
    }

    // 4. Post to GoHighLevel
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ghlPayload),
    });

    if (!ghlRes.ok) {
      const errorData = await ghlRes.text();
      console.error("GHL Error Details:", errorData);
      throw new Error(`GHL API Update Failed: ${ghlRes.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}