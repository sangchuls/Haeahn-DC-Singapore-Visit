// Vercel Serverless Function — Claude API 프록시
// 브라우저에서 직접 호출 시 발생하는 CORS 차단을 우회하고, API 키를 서버에 보관한다.
// 요청: POST { dayIdx: number, context: string }
// 응답: { scenarios: [...] }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다' });
  }

  const { context } = req.body || {};
  if (!context || typeof context !== 'string') {
    return res.status(400).json({ error: 'context 필드가 필요합니다' });
  }

  const prompt = [
    '당신은 싱가포르 출장 경험이 풍부한 건축/데이터센터 전문가 어시스턴트입니다.',
    '아래 일정을 바탕으로 당일 예상 시나리오를 JSON으로 작성하세요.',
    '팀: 김상범(소장/비즈니스석), 정재수(수석), 임상철(책임), 류환재(선임) — 해안건축 DC팀',
    '',
    '=== 당일 일정 ===',
    context.slice(0, 6000),
    '',
    '=== 출력 형식 (순수 JSON만, 코드블록 없이) ===',
    '{"scenarios":[{"type":"dialog|risk|tip|event","icon":"이모지",',
    '"title":"제목","badge":"태그","badgeColor":"#hex",',
    '"dialogs":[{"who":"상대방","side":"left","text":"대화"},{"who":"우리팀","side":"right","text":"응답"}],',
    '"tip":"팁(선택)","warn":"주의(선택)"}]}',
    '',
    '작성 기준:',
    '- 6~8개 시나리오',
    '- 실제 발생 가능한 구체적 대화와 상황',
    '- 영어 대화는 자연스럽게, 한국어 해설과 혼합',
    '- 건축/데이터센터 전문가 관점의 현장 질문과 답변 포함',
    '- side는 반드시 "left" 또는 "right"',
    '- 반드시 JSON만 출력, 다른 텍스트 없이',
  ].join('\n');

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(502).json({ error: 'Claude API 오류', detail: detail.slice(0, 300) });
    }

    const data = await upstream.json();
    const text = data?.content?.[0]?.text || '';

    // 응답에서 JSON 블록만 추출 (모델이 설명을 덧붙이는 경우 대비)
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(502).json({ error: 'JSON 응답을 찾을 수 없습니다' });
    }

    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed.scenarios || !Array.isArray(parsed.scenarios)) {
      return res.status(502).json({ error: 'scenarios 배열이 없습니다' });
    }

    // side 값 정규화 — 프론트가 기대하는 값으로 강제
    parsed.scenarios.forEach(s => {
      (s.dialogs || []).forEach(d => {
        if (d.side !== 'left' && d.side !== 'right') d.side = 'left';
      });
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 300) });
  }
}
