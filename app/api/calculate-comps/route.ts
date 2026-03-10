import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

    // 2. Call Claude API
    const prompt = `
      You are a real estate wholesale analyst. 
      Perform a deep real estate analysis for: ${address}.
      Based on your knowledge of the Houston, TX real estate market, estimate 3 recently 
      SOLD comparable properties within 1 mile of the subject property.
      
      Structure the response EXACTLY in this format:
      
      Property Address: ${address}
      
      AvgPPS: [Calculate average Price Per Sq Ft of the 3 comps]
      ARV: [Estimated After Repair Value]
      Apply % for ARV: 70%
      Repairs: [Estimate based on property age/condition, default to $50k if unknown]
      MAO: [Calculate (ARV * 0.7) - Repairs]
      Offer: [Suggested starting offer]
      
      Profit 5K - [MAO + 5000]
      Profit 10K - [MAO + 10000]
      Profit 15K - [MAO + 15000]
      
      Property 1 : [Full Address]
      - Distance from subject property: [miles]
      - SOLD: [Date and Price]
      - Price / Sq Ft: [Calculate price/sqft]
      
      Property 2 : [Full Address]
      - Distance from subject property: [miles]
      - SOLD: [Date and Price]
      - Price / Sq Ft: [Calculate price/sqft]
      
      Property 3 : [Full Address]
      - Distance from subject property: [miles]
      - SOLD: [Date and Price]
      - Price / Sq Ft: [Calculate price/sqft]

      Analysis: [Add a 3-sentence summary on why this is or isn't a good wholesale deal.]
    `;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // fastest + cheapest Claude model
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiNote = message.content[0].type === "text" ? message.content[0].text : "";

    // 3. Post to GoHighLevel with Opportunity Association
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: aiNote,
        associations: opportunityId ? [
          {
            objectId: opportunityId,
            objectType: "opportunity"
          }
        ] : []
      }),
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