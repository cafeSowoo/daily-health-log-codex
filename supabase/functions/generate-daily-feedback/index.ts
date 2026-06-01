import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "gpt-5-nano";
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function compactText(value: unknown) {
  return String(value ?? "").trim();
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
    if (p.noReading || p.todayPages === 0 || p.todayPages === "0") return [`독서: 📚 독서안함`, compactText(p.memo)].filter(Boolean).join(" · ");
    return [`독서:`, p.todayPages ? `${p.todayPages}p` : "", p.todayMinutes ? `${p.todayMinutes}분` : "", compactText(p.memo)].filter(Boolean).join(" · ");
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function secrets are not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "로그인이 필요합니다." }, 401);

    const body = await req.json().catch(() => ({}));
    const date = compactText(body.date);
    const force = Boolean(body.force);
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

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: [
          "너는 다이어트와 생활 기록을 돕는 다정한 코치다.",
          "비난하지 말고 현실적으로 말한다.",
          "항상 자연스러운 존댓말로 말한다.",
          "의학적 진단, 처방, 확정적 건강 조언은 하지 않는다.",
          "출력은 4개 짧은 문단으로만 구성한다: 오늘 잘한 점, 아쉬운 점, 내일의 작은 행동, 한 줄 응원.",
          "각 문단은 한두 문장으로 제한한다."
        ].join("\n"),
        input: prompt,
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
        max_output_tokens: 1200
      })
    });

    const openaiData = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      console.error("OpenAI response error", openaiData);
      const detail = compactText((openaiData as { error?: { message?: string } }).error?.message);
      return jsonResponse({ error: detail || "AI 피드백 생성에 실패했습니다." }, 502);
    }

    const feedbackText = extractOutputText(openaiData);
    if (!feedbackText) {
      const status = compactText(openaiData.status);
      const reason = compactText((openaiData as { incomplete_details?: { reason?: string } }).incomplete_details?.reason);
      return jsonResponse({ error: reason ? `AI 피드백 내용이 비어 있습니다. (${reason})` : status ? `AI 피드백 내용이 비어 있습니다. (${status})` : "AI 피드백 내용이 비어 있습니다." }, 502);
    }

    const { data: feedback, error: upsertError } = await supabaseAdmin
      .from("codex_daily_feedbacks")
      .upsert({
        user_id: userId,
        feedback_date: date,
        input_snapshot: snapshot,
        feedback_text: feedbackText,
        model: MODEL
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
