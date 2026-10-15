<?php
// Вход в генератор договоров: без пароля компании страница и API не открываются.
// После входа — cookie на год, дальше сотрудник видит обычную программу (с её кодом из 3 цифр).
define('DOGOVORY', 1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');
$c = cfg();
$err = '';

// Поле называется kod и это не type=password: иначе Chrome подставляет сохранённый пароль от сайта.
$pw = (string)($_POST['kod'] ?? $_POST['pw'] ?? '');
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pw !== '') {
  if (too_many_tries()) {
    $err = 'Слишком много попыток. Подождите 15 минут.';
  } elseif ($c['pw_hash'] && password_verify($pw, $c['pw_hash'])) {
    set_login_cookie();
    header('Location: /dogovory/', true, 303);
    exit;
  } else {
    too_many_tries(true);
    $err = $c['pw_hash'] ? 'Неверный пароль.' : 'Программа ещё не настроена.';
  }
}

if (logged_in()) {
  $f = (string)($_GET['f'] ?? '');
  // Файлы программы лежат в app/ с расширением .dat: nginx хостинга сам отдаёт .js/.css
  // в обход .htaccess, а .dat пропускает к Apache, где app/ закрыта.
  $files = ['' => ['index.dat', 'text/html; charset=utf-8'], 'index.html' => ['index.dat', 'text/html; charset=utf-8'],
            'assets.js' => ['assets.dat', 'application/javascript; charset=utf-8']];
  if (!isset($files[$f])) { http_response_code(404); exit; }
  list($file, $type) = $files[$f];
  $path = __DIR__ . '/app/' . $file;
  $etag = '"' . md5_file($path) . '"';
  header('Content-Type: ' . $type);
  header('ETag: ' . $etag);
  header('Cache-Control: private, no-cache');
  if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
  if (!ini_get('zlib.output_compression') && function_exists('ob_gzhandler')) ob_start('ob_gzhandler');
  readfile($path);
  exit;
}

if (($_GET['f'] ?? '') === 'assets.js') { http_response_code(401); exit; }
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Вход — договоры</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F4F1EC;
         font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1E2A44; }
  form { background: #fff; padding: 32px 28px; border-radius: 16px; width: min(340px, calc(100vw - 32px));
         box-sizing: border-box; box-shadow: 0 8px 32px rgba(30, 42, 68, .12); text-align: center; }
  h1 { font-size: 20px; margin: 0 0 4px; font-weight: 800; }
  h1 span { color: #E0603C; }
  p { margin: 0 0 20px; color: #5b6478; font-size: 14px; }
  input { width: 100%; box-sizing: border-box; font-size: 18px; padding: 12px; border: 1px solid #d7d2c8;
          border-radius: 10px; text-align: center; margin-bottom: 12px; }
  button { width: 100%; font-size: 16px; font-weight: 700; padding: 12px; border: 0; border-radius: 10px;
           background: #E0603C; color: #fff; cursor: pointer; }
  .secret { -webkit-text-security: disc; text-security: disc; }
  .err { color: #b3261e; font-size: 14px; margin: -4px 0 12px; }
</style>
</head>
<body>
<form method="post" action="/dogovory/">
  <h1>Мой тёплый <span>дом</span></h1>
  <p>Пароль сотрудников компании</p>
  <input type="text" name="kod" id="kod" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric" class="secret" autofocus required>
  <?php if ($err) echo '<div class="err">' . htmlspecialchars($err) . '</div>'; ?>
  <button type="submit">Войти</button>
</form>
<script>
  // на случай, если браузер всё же что-то подставил
  var k = document.getElementById('kod'), typed = false;
  k.addEventListener('input', function () { typed = true; });
  k.value = ''; setTimeout(function () { if (!typed) k.value = ''; }, 300);
</script>
</body>
</html>
