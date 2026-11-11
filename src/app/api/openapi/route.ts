import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/openapi/spec';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(buildOpenApiSpec());
}
