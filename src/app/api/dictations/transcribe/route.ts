import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// POST /api/dictations/transcribe — Audio → Berko AI Transscribe v2 → Rohtext
export async function POST(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return unauthorized();

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) return NextResponse.json({ error: "Keine Audiodatei übermittelt" }, { status: 400 });

  const elForm = new FormData();
  elForm.append("file", audio, "recording.webm");
  elForm.append("model_id", "scribe_v2");
  elForm.append("language_code", "de");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
    body: elForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[ElevenLabs]", res.status, err);
    return NextResponse.json({ error: `ElevenLabs Fehler: ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const text: string = data.text ?? "";
  return NextResponse.json({ text });
}
