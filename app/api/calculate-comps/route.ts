import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { contactId, address } = await req.json();

    // Initialize Gemini 3.1 Pro with Search Grounding
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-pro-preview", // The latest flagship
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
      Repairs: [Estimate based on property age/condition found in records, default to $50k if unknown]
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

      Analysis: [Add a 3-sentence summary on why this is or isn't a good wholesale deal based on the data found.]
    `;

    const result = await model.generateContent(prompt);
    const formattedNote = result.response.text();

    // Post to GoHighLevel
    const ghlRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: formattedNote }),
    });

    if (!ghlRes.ok) throw new Error('GHL API Update Failed');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}