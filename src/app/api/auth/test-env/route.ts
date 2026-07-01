import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const testGetFirebaseAdminApp = () => {
  const activeApps = getApps();
  const testAppName = 'test-diagnostic-app';
  const existingApp = activeApps.find(app => app.name === testAppName);
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let cleanJson = serviceAccountJson.trim();
    if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
      cleanJson = cleanJson.slice(1, -1).trim();
    } else if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
      cleanJson = cleanJson.slice(1, -1).trim();
    }

    let credentials;
    if (cleanJson.startsWith('{')) {
      credentials = JSON.parse(cleanJson);
    } else {
      credentials = JSON.parse(fs.readFileSync(cleanJson, 'utf8'));
    }

    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    return initializeApp({
      credential: cert(credentials),
    }, testAppName);
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'glass-cutting-app';
  return initializeApp({
    projectId,
  }, testAppName);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // If action is run-test, perform the Firestore query test
  if (action === 'run-test') {
    try {
      const app = testGetFirebaseAdminApp();
      const db = getFirestore(app);
      const testSnap = await db.collection('users').get();
      const users = testSnap.docs.map(doc => ({ id: doc.id, email: doc.data().email, role: doc.data().role }));
      return NextResponse.json({
        status: 'success',
        usersCount: testSnap.size,
        users,
      });
    } catch (err: any) {
      return NextResponse.json({
        status: 'error',
        message: err.message,
        stack: err.stack,
      });
    }
  }

  // Otherwise, return the interactive HTML diagnostic workspace
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Firebase & Authentication Diagnostics</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 650px; margin: 0 auto 30px auto; padding: 30px; border: 1px solid #e1e4e8; }
        h1 { font-size: 1.5rem; margin-top: 0; color: #1a202c; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.9rem; color: #4a5568; }
        input { width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
        button { background-color: #3182ce; color: white; border: none; padding: 10px 16px; border-radius: 4px; font-size: 1rem; cursor: pointer; font-weight: 600; transition: background 0.15s; }
        button:hover { background-color: #2b6cb0; }
        .secondary-btn { background-color: #718096; margin-left: 10px; }
        .secondary-btn:hover { background-color: #4a5568; }
        pre { background-color: #2d3748; color: #a0aec0; padding: 15px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.9rem; max-height: 400px; }
        .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 15px; }
        .status-badge.success { background-color: #c6f6d5; color: #22543d; }
        .status-badge.error { background-color: #fed7d7; color: #742a2a; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔍 Firebase & Authentication Diagnostics</h1>
        <div style="margin-bottom: 20px;">
          <button id="runDbTestBtn">Run Firestore Database Connection Test</button>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
        
        <h1>🔐 Test POST /api/auth/login Endpoint</h1>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" value="admin@glasscutting.com">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" value="admin123">
        </div>
        <button id="submitLoginBtn">Test POST /api/auth/login</button>
      </div>

      <div class="card">
        <h1>🖥️ Console Log Output</h1>
        <div id="statusIndicator" class="status-badge" style="display: none;"></div>
        <pre id="output">Waiting for command...</pre>
      </div>

      <script>
        const output = document.getElementById('output');
        const statusIndicator = document.getElementById('statusIndicator');
        
        function setStatus(text, type) {
          statusIndicator.innerText = text;
          statusIndicator.className = 'status-badge ' + type;
          statusIndicator.style.display = 'inline-block';
        }

        document.getElementById('runDbTestBtn').addEventListener('click', async () => {
          output.innerText = 'Testing Firestore connection...';
          statusIndicator.style.display = 'none';
          try {
            const res = await fetch('/api/auth/test-env?action=run-test');
            const data = await res.json();
            output.innerText = JSON.stringify(data, null, 2);
            if (data.status === 'success') {
              setStatus('Success', 'success');
            } else {
              setStatus('Failed', 'error');
            }
          } catch (err) {
            output.innerText = err.message;
            setStatus('Network Error', 'error');
          }
        });

        document.getElementById('submitLoginBtn').addEventListener('click', async () => {
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          output.innerText = 'Sending POST request to /api/auth/login...';
          statusIndicator.style.display = 'none';

          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });

            const text = await res.text();
            
            output.innerText = 'HTTP Status Code: ' + res.status + ' ' + res.statusText + '\\n\\n' + text;
            if (res.ok) {
              setStatus('Login endpoint OK', 'success');
            } else {
              setStatus('Login endpoint error (' + res.status + ')', 'error');
            }
          } catch (err) {
            output.innerText = err.message;
            setStatus('Network Error', 'error');
          }
        });
      </script>
    </body>
    </html>
  `;

  return new NextResponse(htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
