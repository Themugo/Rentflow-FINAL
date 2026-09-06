import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
const systemPrompt = `You are a receipt parsing assistant. Extract payment details from receipt images and text accurately.

Extract the following information if visible:
- amount: The payment amount (number only, no currency symbols)
- payment_date: The date of payment in YYYY-MM-DD format
- payment_method: One of: mpesa_paybill, mpesa_till, bank_transfer, cash, cheque, other
- reference_number: Transaction ID, M-Pesa code, or bank reference
- notes: Any other relevant details like recipient name or description

For M-Pesa receipts, look for:
- Transaction codes starting with letters (e.g., "QJK123ABC", "SJK1ABC2DE")
- Amount after "Amount" or "Paid" or "Ksh"
- Date and time of transaction

For bank transfers, look for:
- Reference numbers
- Transaction dates
- Transferred amounts

Return ONLY a valid JSON object with the extracted fields. If a field cannot be determined, use null.`;

const tools = [
  {
    type: "function",
    function: {
      name: "extract_receipt_details",
      description: "Extract payment details from a receipt",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "The payment amount as a number",
          },
          payment_date: {
            type: "string",
            description: "The date of payment in YYYY-MM-DD format",
          },
          payment_method: {
            type: "string",
            enum: ["mpesa_paybill", "mpesa_till", "bank_transfer", "cash", "cheque", "other"],
            description: "The method of payment",
          },
          reference_number: {
            type: "string",
            description: "Transaction ID, M-Pesa code, or bank reference",
          },
          notes: {
            type: "string",
            description: "Any other relevant details",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

async function parseFromText(textContent: string, req: Request): Promise<Response> {
  const LOVABLE_API_KEY = getEnv("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const userPrompt = `Extract payment details from this receipt/transaction text:

${textContent}

Return a JSON object with these fields:
{
  "amount": <number or null>,
  "payment_date": "<YYYY-MM-DD or null>",
  "payment_method": "<mpesa_paybill|mpesa_till|bank_transfer|cash|cheque|other or null>",
  "reference_number": "<string or null>",
  "notes": "<string or null>"
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "extract_receipt_details" } },
    }),
  });

  return handleAIResponse(response, req);
}

async function parseFromImage(imageBase64: string, mimeType: string, req: Request): Promise<Response> {
  const LOVABLE_API_KEY = getEnv("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const userPrompt = `Extract payment details from this receipt image. Return a JSON object with these fields:
{
  "amount": <number or null>,
  "payment_date": "<YYYY-MM-DD or null>",
  "payment_method": "<mpesa_paybill|mpesa_till|bank_transfer|cash|cheque|other or null>",
  "reference_number": "<string or null>",
  "notes": "<string or null>"
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "extract_receipt_details" } },
    }),
  });

  return handleAIResponse(response, req);
}

async function handleAIResponse(response: Response, req: Request): Promise<Response> {
  if (!response.ok) {
    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please try again later." }),
        { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error("Failed to process receipt");
  }

  const data = await response.json();

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const extractedData = JSON.parse(toolCall.function.arguments);
    
    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (content) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extractedData = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, data: extractedData }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: "Could not extract receipt details" }),
    { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing or invalid authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Auth validation error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid user session" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    // Rate limit: 20 AI receipt parses per user per hour
    if (!await checkRateLimit(supabaseClient, userId, "parse-receipt", RATE_LIMITS["parse-receipt"])) {
      return rateLimitResponse(req);
    }

    const { imageBase64, mimeType, textContent } = await req.json();

    // Handle PDF text content extraction
    if (textContent) {
      return await parseFromText(textContent, req);
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return await parseFromImage(imageBase64, mimeType, req);

  } catch (error) {
    console.error("Parse receipt error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
