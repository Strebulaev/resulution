import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;

    // Определяем платформу
    const platform = webhookData.platform || (webhookData.vacancy ? 'hh' : 'habr');

    // Логируем входящий webhook для отладки
    console.log(`Received ${platform.toUpperCase()} webhook:`, JSON.stringify(webhookData, null, 2));

    // Валидация webhook данных
    if (!webhookData || typeof webhookData !== 'object') {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // Определяем пользователя по данным webhook (нужно настроить маппинг)
    // В реальном приложении нужно определить user_id по vacancy_id или другим данным
    let userId: string | null = null;

    // Пример: если webhook содержит user_id
    if (webhookData.user_id) {
      userId = webhookData.user_id;
    } else if (webhookData.vacancy && webhookData.vacancy.id) {
      // Ищем пользователя по vacancy_id в базе данных
      const { data: vacancyData } = await supabase
        .from('user_vacancies')
        .select('user_id')
        .eq('vacancy_id', webhookData.vacancy.id)
        .single();

      if (vacancyData) {
        userId = vacancyData.user_id;
      }
    }

    if (!userId) {
      console.warn('Could not determine user for webhook:', webhookData);
      return res.status(200).json({ message: 'Webhook processed but user not found' });
    }

    // Создаем уведомление в базе данных
    const notificationData = {
      user_id: userId,
      type: getNotificationType(webhookData.action, platform),
      title: getNotificationTitle(webhookData.action, platform),
      message: getNotificationMessage(webhookData, platform),
      data: { ...webhookData, platform },
      read: false,
      important: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_notifications')
      .insert(notificationData);

    if (error) {
      console.error('Error saving notification:', error);
      return res.status(500).json({ error: 'Failed to save notification' });
    }

    console.log('Notification created successfully for user:', userId);
    return res.status(200).json({ message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getNotificationType(action?: string, platform: string = 'hh'): string {
  const typeMap: { [key: string]: string } = {
    'new_negotiation_vacancy': 'feature',
    'new_response_or_invitation_vacancy': 'feature',
    'vacancy_change': 'system',
    'vacancy_archivation': 'security',
    'vacancy_publication_for_vacancy_manager': 'feature',
    'negotiation_employer_state_change': 'system'
  };

  return typeMap[action || ''] || 'system';
}

function getNotificationTitle(action?: string, platform: string = 'hh'): string {
  const platformName = platform === 'habr' ? 'Habr Career' : 'HH.ru';
  const titleMap: { [key: string]: string } = {
    'new_negotiation_vacancy': 'Новый отклик на вакансию',
    'new_response_or_invitation_vacancy': 'Новое приглашение',
    'vacancy_change': 'Изменение вакансии',
    'vacancy_archivation': 'Вакансия архивирована',
    'vacancy_publication_for_vacancy_manager': 'Вакансия опубликована',
    'negotiation_employer_state_change': 'Изменение статуса отклика'
  };

  return titleMap[action || ''] || `Уведомление от ${platformName}`;
}

function getNotificationMessage(webhookData: any, platform: string = 'hh'): string {
  const platformName = platform === 'habr' ? 'Habr Career' : 'HH.ru';
  const vacancyName = webhookData.vacancy?.name || 'вакансия';

  switch (webhookData.action) {
    case 'new_negotiation_vacancy':
      return `Получен новый отклик на вакансию "${vacancyName}"`;
    case 'new_response_or_invitation_vacancy':
      return `Получено новое приглашение на вакансию "${vacancyName}"`;
    case 'vacancy_change':
      return `Вакансия "${vacancyName}" была изменена`;
    case 'vacancy_archivation':
      return `Вакансия "${vacancyName}" была архивирована`;
    case 'vacancy_publication_for_vacancy_manager':
      return `Вакансия "${vacancyName}" была опубликована`;
    case 'negotiation_employer_state_change':
      return `Статус отклика на вакансию "${vacancyName}" был изменен`;
    default:
      return `Получено уведомление от ${platformName}: ${webhookData.action || 'неизвестное действие'}`;
  }
}