// import { VercelRequest, VercelResponse } from '@vercel/node';

// const HH_CLIENT_ID = process.env['HH_CLIENT_ID'];
// const HH_CLIENT_SECRET = process.env['HH_CLIENT_SECRET'];
// const BASE_URL = process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://localhost:3000';

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }

//   if (req.method === 'GET') {
//     // Redirect to HH.ru OAuth
//     const redirectUri = `${BASE_URL}/api/hh/callback`;
//     const authUrl = `https://hh.ru/oauth/authorize?response_type=code&client_id=${HH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=resume+negotiations`;

//     return res.redirect(authUrl);
//   }

//   if (req.method === 'POST') {
//     const { code, userId } = req.body;

//     if (!code || !userId) {
//       return res.status(400).json({ error: 'Missing code or userId' });
//     }

//     if (!HH_CLIENT_ID || !HH_CLIENT_SECRET) {
//       return res.status(500).json({ error: 'HH.ru configuration missing' });
//     }

//     try {
//       // Exchange code for access token
//       const tokenResponse = await fetch('https://api.hh.ru/token', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded'
//         },
//         body: new URLSearchParams({
//           grant_type: 'authorization_code',
//           client_id: HH_CLIENT_ID,
//           client_secret: HH_CLIENT_SECRET,
//           code: code,
//           redirect_uri: `${BASE_URL}/api/hh/callback`
//         })
//       });

//       if (!tokenResponse.ok) {
//         const errorText = await tokenResponse.text();
//         throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
//       }

//       const tokenData = await tokenResponse.json();

//       // Store tokens securely (in production, use encrypted storage)
//       // For now, we'll return them to the client to store in localStorage
//       // In production, implement proper token storage

//       return res.status(200).json({
//         success: true,
//         access_token: tokenData.access_token,
//         refresh_token: tokenData.refresh_token,
//         expires_in: tokenData.expires_in
//       });

//     } catch (error: any) {
//       console.error('HH.ru auth error:', error);
//       return res.status(500).json({
//         error: 'Authentication failed',
//         message: error.message
//       });
//     }
//   }

//   return res.status(405).json({ error: 'Method not allowed' });
// }