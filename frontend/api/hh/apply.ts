// import { VercelRequest, VercelResponse } from '@vercel/node';

// interface HHResume {
//   id: string;
//   title: string;
//   created_at: string;
//   updated_at: string;
//   status: {
//     id: string;
//     name: string;
//   };
// }

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }

//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const { vacancyId, resumeData, accessToken, userId } = req.body;

//   if (!vacancyId || !resumeData || !accessToken || !userId) {
//     return res.status(400).json({ error: 'Missing required parameters' });
//   }

//   try {
//     // First, create or update resume on HH.ru
//     const resumeResponse = await createOrUpdateHHResume(resumeData, accessToken);

//     if (!resumeResponse.success || !resumeResponse.resumeId) {
//       throw new Error(`Failed to create/update resume: ${resumeResponse.error}`);
//     }

//     // Then apply to the vacancy
//     const applyResponse = await applyToVacancy(vacancyId, resumeResponse.resumeId, accessToken);

//     if (!applyResponse.success) {
//       throw new Error(`Failed to apply: ${applyResponse.error}`);
//     }

//     return res.status(200).json({
//       success: true,
//       application: {
//         vacancyId,
//         resumeId: resumeResponse.resumeId,
//         status: 'applied',
//         appliedAt: new Date().toISOString(),
//         platform: 'hh.ru'
//       }
//     });

//   } catch (error: any) {
//     console.error('HH.ru apply error:', error);
//     return res.status(500).json({
//       error: 'Application failed',
//       message: error.message
//     });
//   }
// }

// async function createOrUpdateHHResume(resumeData: any, accessToken: string): Promise<{ success: boolean; resumeId?: string; error?: string }> {
//   try {
//     // Check if user already has resumes
//     const resumesResponse = await fetch('https://api.hh.ru/resumes/mine', {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'User-Agent': 'Rezulution/1.0 (career-platform)'
//       }
//     });

//     if (!resumesResponse.ok) {
//       throw new Error(`Failed to fetch resumes: ${resumesResponse.status}`);
//     }

//     const resumesData = await resumesResponse.json();
//     let resumeId: string | null = null;

//     // Find existing resume or create new one
//     if (resumesData.items && resumesData.items.length > 0) {
//       // Use the first resume (in production, you might want to create a specific one for auto-apply)
//       resumeId = resumesData.items[0].id;
//     } else {
//       // Create new resume
//       const createResponse = await fetch('https://api.hh.ru/resumes', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'User-Agent': 'Rezulution/1.0 (career-platform)'
//         },
//         body: JSON.stringify({
//           title: `${resumeData.position || 'Auto-generated'} - Rezulution`,
//           area: { id: resumeData.area || '1' }, // Moscow by default
//           salary: resumeData.salary ? {
//             amount: resumeData.salary,
//             currency: 'RUR'
//           } : undefined,
//           experience: resumeData.experience || [],
//           education: resumeData.education || [],
//           skills: resumeData.skills || [],
//           contacts: resumeData.contacts || [],
//           language: resumeData.languages || []
//         })
//       });

//       if (!createResponse.ok) {
//         const errorData = await createResponse.text();
//         throw new Error(`Failed to create resume: ${createResponse.status} - ${errorData}`);
//       }

//       const newResume = await createResponse.json();
//       resumeId = newResume.id;
//     }

//     // Update resume with latest data
//     if (resumeId) {
//       const updateResponse = await fetch(`https://api.hh.ru/resumes/${resumeId}`, {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'User-Agent': 'Rezulution/1.0 (career-platform)'
//         },
//         body: JSON.stringify({
//           title: `${resumeData.position || 'Auto-generated'} - Rezulution`,
//           area: { id: resumeData.area || '1' },
//           salary: resumeData.salary ? {
//             amount: resumeData.salary,
//             currency: 'RUR'
//           } : undefined,
//           experience: resumeData.experience || [],
//           education: resumeData.education || [],
//           skills: resumeData.skills || [],
//           contacts: resumeData.contacts || [],
//           language: resumeData.languages || []
//         })
//       });

//       if (!updateResponse.ok) {
//         console.warn(`Failed to update resume: ${updateResponse.status}`);
//       }
//     }

//     return { success: true, resumeId: resumeId || undefined };

//   } catch (error: any) {
//     console.error('Resume creation/update error:', error);
//     return { success: false, error: error.message };
//   }
// }

// async function applyToVacancy(vacancyId: string, resumeId: string, accessToken: string) {
//   try {
//     const applyResponse = await fetch(`https://api.hh.ru/negotiations`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'Content-Type': 'application/json',
//         'User-Agent': 'Rezulution/1.0 (career-platform)'
//       },
//       body: JSON.stringify({
//         vacancy_id: vacancyId,
//         resume_id: resumeId,
//         message: 'Отклик через платформу Rezulution - автоматизированная система поиска работы'
//       })
//     });

//     if (!applyResponse.ok) {
//       const errorData = await applyResponse.text();
//       throw new Error(`Application failed: ${applyResponse.status} - ${errorData}`);
//     }

//     const applyData = await applyResponse.json();

//     return { success: true, applicationId: applyData.id };

//   } catch (error: any) {
//     console.error('Application error:', error);
//     return { success: false, error: error.message };
//   }
// }