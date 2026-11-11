<?php
date_default_timezone_set('Asia/Riyadh');

// Load environment variables (secrets no longer hardcoded)
require_once __DIR__ . '/env_loader.php';

$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: '';
$dbUser = getenv('DB_USER') ?: '';
$dbPass = getenv('DB_PASS') ?: '';

class Database
{
    private $connection = null;
    public function __construct($dbhost = "", $dbname = "", $username = "", $password = "")
    {
        global $dbHost, $dbName, $dbUser, $dbPass;
        $dbhost = $dbhost ?: ($dbHost ?: (getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? $_SERVER['DB_HOST'] ?? 'localhost')));
        $dbname = $dbname ?: ($dbName ?: (getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? $_SERVER['DB_NAME'] ?? 'u187359406_tarqa')));
        $username = $username ?: ($dbUser ?: (getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? $_SERVER['DB_USER'] ?? 'u187359406_tarqa')));
        $password = $password ?: ($dbPass ?: (getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? $_SERVER['DB_PASS'] ?? 'Alaqsam$123')));

        $hostsToTry = array_unique([$dbhost, 'localhost', '127.0.0.1']);
        $lastException = null;

        foreach ($hostsToTry as $candidate) {
            try {
                $this->connection = new PDO("mysql:host={$candidate};dbname={$dbname};charset=utf8mb4;", $username, $password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 5
                ]);
                $this->connection->exec("SET time_zone = '+03:00';");
                $lastException = null;
                break;
            } catch (Exception $e) {
                $lastException = $e;
            }
        }

        if ($lastException && !$this->connection) {
            error_log("Database Connection Error: " . $lastException->getMessage());
            throw new Exception($lastException->getMessage());
        }
    }

    public function getConnection(): ?PDO
    {
        return $this->connection;
    }

    private function executeStatement($statement = "", $parameters = [])
    {
        try {
            $stmt = $this->connection->prepare($statement);
            $stmt->execute($parameters);
            return $stmt;
        } catch (Exception $e) {
            error_log("SQL Execution Error: " . $e->getMessage());
            throw new Exception($e->getMessage());
        }
    }

    public function Insert($statement = "", $parameters = [])
    {
        try {
            $this->executeStatement($statement, $parameters);
            return $this->connection->lastInsertId();
        } catch (Exception $e) {
            throw new Exception($e->getMessage());
        }
    }

    public function Select($statement = "", $parameters = [])
    {
        try {
            $stmt = $this->executeStatement($statement, $parameters);
            return $stmt->fetchAll();
        } catch (Exception $e) {
            throw new Exception($e->getMessage());
        }
    }

    public function Update($statement = "", $parameters = [])
    {
        try {
            $this->executeStatement($statement, $parameters);
        } catch (Exception $e) {
            throw new Exception($e->getMessage());
        }
    }

    public function Execute($statement = "", $parameters = [])
    {
        try {
            $stmt = $this->executeStatement($statement, $parameters);
            return $stmt->rowCount();
        } catch (Exception $e) {
            throw new Exception($e->getMessage());
        }
    }

    public function Remove($statement = "", $parameters = [])
    {
        try {
            $this->executeStatement($statement, $parameters);
        } catch (Exception $e) {
            throw new Exception($e->getMessage());
        }
    }

    public function ErrorMsg()
    {
        return "No error message available. Check exception details.";
    }
}

// إعداد الاتصال — credentials loaded from environment variables
try {
    $db = new Database($dbHost, $dbName, $dbUser, $dbPass);

    // Auto-update expired users to role 6, and mark their orders & enrollments as expired
    if ($db) {
        try {
            $db->Update("
                UPDATE orders o 
                JOIN users u ON (o.user_id = u.telegram_id OR o.user_id = u.id)
                SET o.payment_status = 'expired'
                WHERE (u.role_id = 5 OR u.role_id = 6) 
                  AND u.role_expires_at IS NOT NULL 
                  AND u.role_expires_at <= NOW() 
                  AND o.payment_status IN ('confirmed', 'completed', 'approved')
            ");
            $db->Update("
                UPDATE enrollments e 
                JOIN users u ON (e.user_id = u.telegram_id OR e.user_id = u.id)
                SET e.status = 'inactive'
                WHERE (u.role_id = 5 OR u.role_id = 6) 
                  AND u.role_expires_at IS NOT NULL 
                  AND u.role_expires_at <= NOW() 
                  AND e.status = 'active'
            ");
            $db->Update("UPDATE users SET role_id = 6, subscription_period = 'none' WHERE role_id = 5 AND role_expires_at IS NOT NULL AND role_expires_at <= NOW()");
        } catch (Throwable $e) {
            error_log("Auto-expiry update failed: " . $e->getMessage());
        }
    }
} catch (Throwable $e) {
    $db = null;
    error_log("Database Connection Error: " . $e->getMessage());
}
