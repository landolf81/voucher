import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Test API working' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ 
      message: 'Test POST working',
      received: body 
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Error', error: String(error) },
      { status: 500 }
    );
  }
}