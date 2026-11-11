<?php
session_start(); // Start the session


// When the user is logged in, go to the home page
if (isset($_SESSION['logged-in']) && $_SESSION['logged-in'] == TRUE) {
    die(header('Location: /'));
}


require_once __DIR__ . '/bot_config.php';
?>
<!DOCTYPE html>
<html lang="en-US">

<head>
    <title>Login</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Nanum+Gothic">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link rel="stylesheet" href="assets/style.css">
</head>

<body>
    <h1>Sign Up & Login With Telegram</h1>
    <div class="middle-center">
        <h1>Hello, Anonymous!</h1>
        <script async src="https://telegram.org/js/telegram-widget.js" data-telegram-login="<?php echo BOT_USERNAME; ?>" data-size="large" data-auth-url="auth.php"></script>    </div>
</body>

</html>