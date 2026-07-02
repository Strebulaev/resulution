import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/profile?sj_error=${error}`);
  }

  if (!code) {
    return res.redirect(`${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/profile?sj_error=no_code`);
  }

  const redirectUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/profile?sj_code=${code}${state ? `&state=${state}` : ''}`;

  return res.redirect(redirectUrl);
}