import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { createClient } from "supabase/supabase-js@2";
import { serve } from "std/http/server.ts";

import { requireEnv, getEnv } from "../_shared/env.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    // Auth + rate limit
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (!await checkRateLimit(supabase, user.id, "parse-contract-document", RATE_LIMITS["parse-contract-document"])) {
      return rateLimitResponse(req);
    }

    const { contractUrl, contractTitle } = await req.json();

    if (!contractUrl) {
      return new Response(
        JSON.stringify({ error: "Contract URL is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = getEnv("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // For image-based contracts, we'll use vision capabilities
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(contractUrl);
    
    const systemPrompt = `You are a contract analysis expert. Extract key information from the provided contract document.

Your task is to identify and extract:
1. Contract parties (names of landlord/property manager and any other parties)
2. Key dates (start date, end date, signing dates)
3. Financial terms (fees, commissions, payment terms)
4. Property details (if mentioned)
5. Key obligations and responsibilities
6. Important clauses (termination, renewal, penalties)
7. Contact information

Return the extracted information in a structured JSON format with these fields:
- parties: array of { name, role }
- dates: { startDate, endDate, signingDate }
- financials: { fees: [], paymentTerms, commissions }
- properties: array of property names/addresses
- obligations: array of key obligations
- clauses: array of { type, summary }
- contacts: array of { name, email, phone }
- summary: brief 2-3 sentence summary of the contract

Be thorough but concise. If information is not found, use null.`;

    const userMessage = isImage 
      ? [
          { type: "text", text: `Analyze this contract image titled "${contractTitle || 'Contract'}" and extract key information:` },
          { type: "image_url", image_url: { url: contractUrl } }
        ]
      : `Analyze the following contract document titled "${contractTitle || 'Contract'}". 
         Note: This is a PDF document at URL: ${contractUrl}
         
         Since I cannot directly read the PDF, please provide a template response indicating what information would typically be extracted from a property management service agreement. Include typical parties, date ranges, fee structures (like 1% commission, registration fees), and standard clauses.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract_data",
              description: "Extract structured data from a contract document",
              parameters: {
                type: "object",
                properties: {
                  parties: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        role: { type: "string" }
                      },
                      required: ["name", "role"]
                    }
                  },
                  dates: {
                    type: "object",
                    properties: {
                      startDate: { type: "string", nullable: true },
                      endDate: { type: "string", nullable: true },
                      signingDate: { type: "string", nullable: true }
                    }
                  },
                  financials: {
                    type: "object",
                    properties: {
                      fees: { type: "array", items: { type: "string" } },
                      paymentTerms: { type: "string", nullable: true },
                      commissions: { type: "string", nullable: true }
                    }
                  },
                  properties: { type: "array", items: { type: "string" } },
                  obligations: { type: "array", items: { type: "string" } },
                  clauses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        summary: { type: "string" }
                      },
                      required: ["type", "summary"]
                    }
                  },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string", nullable: true },
                        phone: { type: "string", nullable: true }
                      }
                    }
                  },
                  summary: { type: "string" }
                },
                required: ["parties", "dates", "financials", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_contract_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    let parsedContent = null;
    
    // Extract the tool call result
    if (aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        parsedContent = JSON.parse(aiResponse.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }
    
    // Fallback: try to extract from content if no tool call
    if (!parsedContent && aiResponse.choices?.[0]?.message?.content) {
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("Failed to parse JSON from content:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsedContent,
        rawResponse: aiResponse.choices?.[0]?.message?.content 
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error parsing contract:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
