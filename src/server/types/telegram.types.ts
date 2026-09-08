// ==============================================================================
// 🚀 منصة طرقع للكمي - أنواع تكامل بوت تليجرام (Telegram Webhook Types)
// ==============================================================================

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  first_name?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: TelegramMessage;
}
