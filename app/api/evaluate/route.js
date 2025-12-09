import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { userText, modelText } = await request.json();

        if (!userText || !modelText) {
            return NextResponse.json({ error: 'Missing text' }, { status: 400 });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }

        const prompt = `
    You are a strict but fair professor correcting a student's oral exam.
    
    Question Answer (Model): "${modelText}"
    Student Answer: "${userText}"
    
    Task:
    1. Evaluate how well the student understood the concept.
    2. Ignore minor filler words or slight phrasing differences if the meaning is correct.
    3. Give a score from 0 to 100.
    4. Provide a very short, one-sentence feedback in Arabic.

    Return ONLY a JSON object:
    {
      "score": number,
      "feedback": "string"
    }
    `;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000", // Required for free tier
                "X-Title": "Flashcard App"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-20b:free",
                messages: [
                    { role: "system", content: "You are a helpful assistant that outputs JSON only." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("OpenRouter Error:", errText);

            if (response.status === 404 && errText.includes("data policy")) {
                return NextResponse.json({
                    score: 0,
                    feedback: "⚠️ خطأ: يجب تفعيل خيار 'Allow training on my data' في إعدادات OpenRouter لاستخدام الموديلات المجانية."
                });
            }

            throw new Error(`OpenRouter API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Parse JSON from content (it might contain markdown code blocks)
        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                result = JSON.parse(content);
            }
        } catch (e) {
            console.error("JSON Parse Error:", e, content);
            // Fallback
            result = { score: 0, feedback: "حدث خطأ في تحليل النتيجة" };
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Evaluation Error:', error);
        // Return a safe error message to the UI instead of 500
        return NextResponse.json({
            score: 0,
            feedback: "حدث خطأ في الاتصال بالذكاء الاصطناعي. يرجى المحاولة لاحقاً."
        });
    }
}
