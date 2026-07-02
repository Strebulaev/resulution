// import { VercelRequest, VercelResponse } from '@vercel/node';

// interface HHVacancy {
//   id: string;
//   name: string;
//   area: {
//     id: string;
//     name: string;
//   };
//   salary?: {
//     from?: number;
//     to?: number;
//     currency: string;
//   };
//   employer: {
//     id: string;
//     name: string;
//   };
//   published_at: string;
//   alternate_url: string;
//   snippet: {
//     requirement?: string;
//     responsibility?: string;
//   };
//   experience?: {
//     id: string;
//     name: string;
//   };
//   employment?: {
//     id: string;
//     name: string;
//   };
//   schedule?: {
//     id: string;
//     name: string;
//   };
// }

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }

//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const { searchParams, accessToken, userId } = req.body;

//   if (!searchParams || !userId) {
//     return res.status(400).json({ error: 'Missing search parameters or userId' });
//   }

//   try {
//     // Build search query for HH.ru API
//     const queryParams = new URLSearchParams();

//     // Basic search parameters
//     if (searchParams.text) {
//       queryParams.set('text', searchParams.text);
//     }

//     if (searchParams.area) {
//       queryParams.set('area', searchParams.area); // City/area ID
//     }

//     if (searchParams.experience) {
//       queryParams.set('experience', searchParams.experience); // experience ID
//     }

//     if (searchParams.employment) {
//       queryParams.set('employment', searchParams.employment); // employment type ID
//     }

//     if (searchParams.schedule) {
//       queryParams.set('schedule', searchParams.schedule); // schedule type ID
//     }

//     if (searchParams.salary) {
//       queryParams.set('salary', searchParams.salary.toString());
//     }

//     // Pagination
//     queryParams.set('per_page', '20');
//     queryParams.set('page', '0');

//     // Sort by relevance
//     queryParams.set('order_by', 'relevance');

//     const searchUrl = `https://api.hh.ru/vacancies?${queryParams.toString()}`;

//     const headers: Record<string, string> = {
//       'User-Agent': 'Rezulution/1.0 (career-platform)'
//     };

//     // Add authorization if token provided
//     if (accessToken) {
//       headers['Authorization'] = `Bearer ${accessToken}`;
//     }

//     const response = await fetch(searchUrl, {
//       headers
//     });

//     if (!response.ok) {
//       throw new Error(`HH.ru API error: ${response.status} ${response.statusText}`);
//     }

//     const data = await response.json();

//     // Transform HH.ru response to our format
//     const vacancies = data.items.map((item: HHVacancy) => ({
//       id: item.id,
//       title: item.name,
//       company: item.employer.name,
//       location: item.area.name,
//       salary: item.salary ? {
//         from: item.salary.from,
//         to: item.salary.to,
//         currency: item.salary.currency
//       } : null,
//       experience: item.experience?.name,
//       employment: item.employment?.name,
//       schedule: item.schedule?.name,
//       description: item.snippet.requirement || item.snippet.responsibility,
//       url: item.alternate_url,
//       publishedAt: item.published_at,
//       source: 'hh.ru'
//     }));

//     return res.status(200).json({
//       success: true,
//       vacancies,
//       total: data.found,
//       page: data.page,
//       pages: data.pages,
//       per_page: data.per_page
//     });

//   } catch (error: any) {
//     console.error('HH.ru search error:', error);
//     return res.status(500).json({
//       error: 'Search failed',
//       message: error.message
//     });
//   }
// }