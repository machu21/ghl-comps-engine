import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    // 1. Parse the Body ONCE
    const body = await req.json();
    console.log("RAW WEBHOOK DATA:", JSON.stringify(body));
    const { contactId, address, opportunityId } = body;

    // Basic Validation
    if (!contactId || !address) {
      return NextResponse.json({ error: "Missing contactId or address" }, { status: 400 });
    }

    // 2. Initialize Gemini 3.1 logic via 1.5-pro string
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro", 
      tools: [{ googleSearchRetrieval: {} }] 
    });

    const prompt = `
      Perform a deep real estate search for: ${address}.
      Using Google Search, find 3 recently SOLD comparable properties within 1 mile.
      
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

    const result = await model.generateContent(prompt);
    const aiNote = result.response.text();

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
        // Linking the note to the specific Opportunity Card
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