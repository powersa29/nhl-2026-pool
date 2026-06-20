import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const PROMPT = `This is a photo of a golf scorecard. Extract the hole-by-hole data and return ONLY valid JSON — no markdown, no explanation.

Return an array of hole objects. Each object must have:
- hole_number: integer (1–18)
- par: integer (3, 4, or 5)
- yards: integer or null (use the yardage closest to the tee box if multiple columns; null if not shown)
- handicap: integer (stroke index / handicap) or null if not shown

Example output:
[{"hole_number":1,"par":4,"yards":350,"handicap":7},{"hole_number":2,"par":3,"yards":140,"handicap":15}]

If the scorecard only shows 9 holes, return 9 objects. Ignore totals rows. Return only the JSON array.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no_key' }, { status: 500 });

  let imageBase64: string;
  let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'no_image' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'unsupported_type' }, { status: 400 });
    }
    mediaType = file.type as typeof mediaType;

    const bytes = await file.arrayBuffer();
    imageBase64 = Buffer.from(bytes).toString('base64');
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = message.content.find(b => b.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: 'parse_failed' }, { status: 422 });

    const holes = JSON.parse(jsonMatch[0]) as {
      hole_number: number; par: number; yards: number | null; handicap: number | null;
    }[];

    if (!Array.isArray(holes) || holes.length === 0) {
      return NextResponse.json({ error: 'no_holes' }, { status: 422 });
    }

    return NextResponse.json({ holes });
  } catch {
    return NextResponse.json({ error: 'api_error' }, { status: 500 });
  }
}
