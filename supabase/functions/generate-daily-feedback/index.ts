import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_MODEL = "gpt-5-nano";
const OWNER_EMAIL = (Deno.env.get("OWNER_EMAIL") || "harminis@gmail.com").toLowerCase();
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CodexRecord = {
  record_type: string;
  payload: Record<string, unknown>;
};

type AiModelConfig = {
  id: string;
  provider: "openai" | "gemini";
};

const AI_MODELS: AiModelConfig[] = [
  { id: "gpt-5-nano", provider: "openai" },
  { id: "gemini-3-flash-preview", provider: "gemini" },
  { id: "gemini-2.5-flash", provider: "gemini" },
  { id: "gemini-2.5-flash-lite", provider: "gemini" }
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function compactText(value: unknown) {
  return String(value ?? "").trim();
}

function modelConfig(modelId: unknown) {
  const id = compactText(modelId) || DEFAULT_MODEL;
  return AI_MODELS.find((model) => model.id === id) || AI_MODELS[0];
}

function mealLabel(value: unknown) {
  return { small: "소식", normal: "적정", overeaten: "과식" }[String(value)] || "";
}

function alcoholLabel(payload: Record<string, unknown>) {
  const level = compactText(payload.drinkLevel) || (payload.didDrink === "yes" ? "moderate" : "none");
  return { none: "금주", moderate: "적당", heavy: "과음" }[level] || "금주";
}

function moodLabel(value: unknown) {
  return { 1: "매우 나쁨", 2: "나쁨", 3: "보통", 4: "좋음", 5: "매우 좋음" }[Number(value)] || "";
}

function readingPageCount(payload: Record<string, unknown>) {
  const startPage = Number(payload.startPage || 0);
  const endPage = Number(payload.endPage || 0);
  const savedPages = Number(payload.todayPages || 0);
  if (startPage > 0 && endPage > 0) return Math.max(0, endPage - startPage + 1);
  if (endPage > 0 && !startPage) return endPage;
  return savedPages;
}

function summarizeRecord(record: CodexRecord) {
  const p = record.payload || {};
  if (record.record_type === "exercise") {
    if (p.noExercise || (!p.exerciseType && !Number(p.durationMinutes || 0) && !p.intensity)) return "운동: 🚫 운동안함";
    return [`운동: ${compactText(p.exerciseType) || "운동"}`, p.durationMinutes ? `${p.durationMinutes}분` : "", p.intensity ? `강도 ${p.intensity}` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "meal") {
    return [`식사:`, p.lunchAmount ? `점심 ${mealLabel(p.lunchAmount)}` : "", p.dinnerAmount ? `저녁 ${mealLabel(p.dinnerAmount)}` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "alcohol") {
    return [`음주: ${alcoholLabel(p)}`, compactText(p.drinkType), compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "mood") {
    return [`마음:`, p.level ? `마음 ${moodLabel(p.level)}` : "", p.workLevel ? `업무 ${moodLabel(p.workLevel)}` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "weight") {
    return [`무게:`, p.weightKg ? `${p.weightKg}kg` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "reading") {
    const pages = readingPageCount(p);
    if (p.noReading || pages === 0 || p.todayPages === "0") return [`독서: 📚 독서안함`, compactText(p.memo)].filter(Boolean).join(" · ");
    return [`독서:`, p.bookTitle ? `책 ${p.bookTitle}` : "", pages ? `${pages}p` : "", p.todayMinutes ? `${p.todayMinutes}분` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "organize") {
    return [`정리:`, p.summaryMinutes ? `${p.summaryMinutes}분` : "", compactText(p.memo)].filter(Boolean).join(" · ");
  }
  if (record.record_type === "memo") return [`오늘의 메모:`, compactText(p.memo)].filter(Boolean).join(" ");
  return `${record.record_type}: ${JSON.stringify(p)}`;
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  const output = Array.isArray(data.output) ? data.output : [];
  return output.flatMap((item) => {
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as Record<string, unknown>[] : [];
    return content.map((part) => compactText(part.text || part.output_text));
  }).filter(Boolean).join("\n").trim();
}

function extractGeminiText(data: Record<string, unknown>) {
  const candidates = Array.isArray(data.candidates) ? data.candidates as Record<string, unknown>[] : [];
  return candidates.flatMap((candidate) => {
    const content = candidate.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts as Record<string, unknown>[] : [];
    return parts.map((part) => compactText(part.text));
  }).filter(Boolean).join("\n").trim();
}

function instructionsText() {
  return [
    "너는 다이어트와 생활 기록을 돕는 다정한 코치다.",
    "비난하지 말고 현실적으로 말한다.",
    "항상 자연스러운 존댓말로 말한다.",
    "의학적 진단, 처방, 확정적 건강 조언은 하지 않는다.",
    "출력은 4개 짧은 문단으로만 구성한다: 오늘 잘한 점, 아쉬운 점, 내일의 작은 행동, 한 줄 응원.",
    "각 문단은 한두 문장으로 제한한다."
  ].join("\n");
}

async function generateOpenAiFeedback(apiKey: string, model: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: instructionsText(),
      input: prompt,
      reasoning: { effort: "minimal" },
      text: { verbosity: "low" },
      max_output_tokens: 1200
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OpenAI response error", data);
    const detail = compactText((data as { error?: { message?: string } }).error?.message);
    throw new Error(detail || "AI 피드백 생성에 실패했습니다.");
  }

  const text = extractOutputText(data);
  if (!text) {
    const status = compactText((data as Record<string, unknown>).status);
    const reason = compactText((data as { incomplete_details?: { reason?: string } }).incomplete_details?.reason);
    throw new Error(reason ? `AI 피드백 내용이 비어 있습니다. (${reason})` : status ? `AI 피드백 내용이 비어 있습니다. (${status})` : "AI 피드백 내용이 비어 있습니다.");
  }
  return text;
}

async function generateGeminiFeedback(apiKey: string, model: string, prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructionsText() }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Gemini response error", data);
    const detail = compactText((data as { error?: { message?: string } }).error?.message);
    throw new Error(detail || `Gemini 피드백 생성에 실패했습니다. (${response.status})`);
  }

  const text = extractGeminiText(data);
  if (!text) throw new Error("Gemini 피드백 내용이 비어 있습니다.");
  return text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function secrets are not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "로그인이 필요합니다." }, 401);

    const body = await req.json().catch(() => ({}));
    const date = compactText(body.date);
    const force = Boolean(body.force);
    const selectedModel = modelConfig(body.model);
    if (selectedModel.provider === "openai" && !openaiApiKey) return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500);
    if (selectedModel.provider === "gemini" && !geminiApiKey) return jsonResponse({ error: "GEMINI_API_KEY is not configured. Supabase Function Secret에 Gemini API 키를 추가해야 합니다." }, 500);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "날짜 형식이 올바르지 않습니다." }, 400);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return jsonResponse({ error: "로그인 정보를 확인하지 못했습니다." }, 401);
    if ((userData.user.email || "").toLowerCase() !== OWNER_EMAIL) return jsonResponse({ error: "피드백 생성 권한이 없습니다." }, 403);

    const userId = userData.user.id;
    const existingQuery = supabaseAdmin
      .from("codex_daily_feedbacks")
      .select("*")
      .eq("user_id", userId)
      .eq("feedback_date", date)
      .maybeSingle();
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw existingError;
    if (existing && !force) return jsonResponse({ feedback: existing, reused: true });

    const { data: records, error: recordsError } = await supabaseAdmin
      .from("codex_records")
      .select("record_type,payload,created_at")
      .eq("user_id", userId)
      .eq("record_date", date)
      .order("created_at", { ascending: true });
    if (recordsError) throw recordsError;

    const lines = (records || []).map((record) => summarizeRecord(record as CodexRecord)).filter(Boolean);
    if (!lines.length) return jsonResponse({ error: "피드백을 만들 기록이 없습니다." }, 400);

    const snapshot = {
      date,
      model: selectedModel.id,
      provider: selectedModel.provider,
      records: records || [],
      summaries: lines
    };
    const prompt = [
      `${date} 하루 기록입니다.`,
      "",
      lines.map((line) => `- ${line}`).join("\n"),
      "",
      "이 기록을 바탕으로 사용자가 내일 다시 기록하고 싶어지게 한국어로 짧게 피드백해 주세요."
    ].join("\n");

    const feedbackText = selectedModel.provider === "gemini"
      ? await generateGeminiFeedback(geminiApiKey || "", selectedModel.id, prompt)
      : await generateOpenAiFeedback(openaiApiKey || "", selectedModel.id, prompt);

    const { data: feedback, error: upsertError } = await supabaseAdmin
      .from("codex_daily_feedbacks")
      .upsert({
        user_id: userId,
        feedback_date: date,
        input_snapshot: snapshot,
        feedback_text: feedbackText,
        model: selectedModel.id
      }, { onConflict: "user_id,feedback_date" })
      .select("*")
      .single();
    if (upsertError) throw upsertError;

    return jsonResponse({ feedback, reused: false });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "피드백 생성 중 오류가 발생했습니다." }, 500);
  }
});
