import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

  if (!serviceAccountJson) {
    return NextResponse.json({
      status: 'error',
      message: 'FIREBASE_SERVICE_ACCOUNT_JSON is missing or undefined',
      projectId: projectId || 'undefined',
    });
  }

  const trimmed = serviceAccountJson.trim();
  const startsWithCurly = trimmed.startsWith('{');
  const endsWithCurly = trimmed.endsWith('}');
  const length = serviceAccountJson.length;
  
  let parseResult = 'not-attempted';
  let first30 = trimmed.substring(0, 30);
  let last30 = trimmed.substring(trimmed.length - 30);
  let fileCheck = 'not-applicable';

  try {
    let cleanJson = trimmed;
    if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
      cleanJson = cleanJson.slice(1, -1).trim();
    } else if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
      cleanJson = cleanJson.slice(1, -1).trim();
    }
    
    if (cleanJson.startsWith('{')) {
      JSON.parse(cleanJson);
      parseResult = 'success (parsed inline JSON)';
    } else {
      fileCheck = `checking if file exists: ${cleanJson}`;
      if (fs.existsSync(cleanJson)) {
        const fileContent = fs.readFileSync(cleanJson, 'utf8');
        JSON.parse(fileContent);
        parseResult = 'success (parsed JSON file)';
      } else {
        parseResult = 'error: file path does not exist';
      }
    }
  } catch (err: any) {
    parseResult = `error: ${err.message}`;
  }

  return NextResponse.json({
    status: 'ok',
    projectId: projectId || 'undefined',
    length,
    startsWithCurly,
    endsWithCurly,
    first30,
    last30,
    fileCheck,
    parseResult,
  });
}
