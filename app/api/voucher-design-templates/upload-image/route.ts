import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// 허용된 이미지 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST: 이미지 업로드
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'a4' or 'mobile'

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: '이미지 파일이 필요합니다.'
        },
        { status: 400 }
      );
    }

    if (!type || !['a4', 'mobile'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: '이미지 타입을 지정해주세요. (a4 또는 mobile)'
        },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: '지원되지 않는 파일 형식입니다. (JPEG, PNG, WebP만 허용)'
        },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: '파일 크기는 10MB 이하여야 합니다.'
        },
        { status: 400 }
      );
    }

    console.log('이미지 업로드 API 호출:', { 
      fileName: file.name, 
      type: file.type, 
      size: file.size, 
      imageType: type 
    });

    // 파일 확장자 추출
    const extension = path.extname(file.name).toLowerCase();
    
    // 고유한 파일명 생성
    const uniqueId = nanoid();
    const fileName = `voucher-template-${type}-${uniqueId}${extension}`;
    
    // 업로드 디렉터리 경로
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'voucher-templates');
    
    // 디렉터리가 없으면 생성
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 파일 저장 경로
    const filePath = path.join(uploadDir, fileName);
    
    // 파일 데이터 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일 저장
    await writeFile(filePath, buffer);

    // 공개 URL 생성
    const publicUrl = `/uploads/voucher-templates/${fileName}`;

    console.log('이미지 업로드 완료:', { fileName, publicUrl });

    return NextResponse.json({
      success: true,
      message: '이미지가 업로드되었습니다.',
      data: {
        fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl,
        imageType: type
      }
    });

  } catch (error) {
    console.error('이미지 업로드 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '이미지 업로드 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}