<?php
// Central Telegram Bot Configuration — secrets loaded from environment variables
require_once __DIR__ . '/env_loader.php';

if (!defined('BOT_TOKEN')) {
    define('BOT_TOKEN', getenv('TELEGRAM_BOT_TOKEN') ?: '');
}
if (!defined('BOT_USERNAME')) {
    define('BOT_USERNAME', getenv('TELEGRAM_BOT_USERNAME') ?: 'TarqaBot');
}
