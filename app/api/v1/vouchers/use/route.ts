import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest){
  const body = await req.json().catch(()=>({}));
  const serial = String(body.serial_no || "");
  if (!serial) return NextResponse.json({ ok:false, error:"SERIAL_REQUIRED" }, { status:400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("use_voucher_by_serial", { p_serial: serial });
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  if (!data) return NextResponse.json({ ok:false, error:"NOT_FOUND_OR_ALREADY_USED" }, { status:409 });
  return NextResponse.json({ ok:true, used:data });
}
