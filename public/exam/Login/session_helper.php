<?php
/**
 * Session & Dev Bypass Helper
 * Provides unified session initialization, cookie parameter management,
 * and a secure, configurable Dev Bypass mechanism for local development.
 */

if (file_exists(__DIR__ . '/env_loader.php')) {
    require_once __DIR__ . '/env_loader.php';
} elseif (file_exists(__DIR__ . '/../../env_loader.php')) {
    require_once __DIR__ . '/../../env_loader.php';
}

if (!function_exists('isDevHost')) {
    function isDevHost(): bool {
        // Only allow strict local loopback IP, never trust client-manipulable Host or Origin headers
        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
        return in_array($remoteAddr, ['127.0.0.1', '::1'], true);
    }
}

if (!function_exists('isDevBypassEnabled')) {
    function isDevBypassEnabled(): bool {
        // Disabled by default. Must be explicitly set to '1' or 'true' AND coming from loopback
        $bypassConfig = getenv('DEV_BYPASS');
        if ($bypassConfig === false && isset($_ENV['DEV_BYPASS'])) {
            $bypassConfig = $_ENV['DEV_BYPASS'];
        }
        if ($bypassConfig === false && isset($_SERVER['DEV_BYPASS'])) {
            $bypassConfig = $_SERVER['DEV_BYPASS'];
        }

        if ($bypassConfig !== false && $bypassConfig !== null && $bypassConfig !== '') {
            $val = strtolower(trim((string)$bypassConfig));
            if (in_array($val, ['1', 'true', 'on', 'yes'], true)) {
                return isDevHost();
            }
        }

        return false;
    }
}

if (!function_exists('initSession')) {
    function initSession(): void {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            $seven_days = 7 * 24 * 60 * 60;
            ini_set('session.gc_maxlifetime', $seven_days);
            $isSecure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
                        (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
            session_set_cookie_params([
                'lifetime' => $seven_days,
                'path' => '/',
                'domain' => '',
                'secure' => $isSecure,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);
            session_start();
        }

        // Apply Dev Bypass if active and user session is not already set
        if (isDevBypassEnabled()) {
            if (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in'] || empty($_SESSION['telegram_id'])) {
                $_SESSION['logged-in'] = true;
                $_SESSION['telegram_id'] = '123456789';
                $_SESSION['role_id'] = 1;
                $_SESSION['permissions'] = ['admin', 'owner', 'access_simulators', 'access_exams', 'edit_users', 'manage_users'];
                $_SESSION['user'] = [
                    'id' => '123456789',
                    'telegram_id' => '123456789',
                    'first_name' => 'Local',
                    'last_name' => 'Developer',
                    'username' => 'dev',
                    'photo_url' => 'https://i.ibb.co/tMMyJj2y/icon.jpg',
                    'role_id' => 1,
                    'role' => 'owner'
                ];
            }
        }
    }
}
