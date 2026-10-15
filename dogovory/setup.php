<?php
// Настройка генератора договоров на хостинге (один раз и при смене ключа/пароля).
// Доступ — только по коду настройки (его sha256 ниже; сам код — в .env закрытого репозитория dogovory).
// Записывает в папку данных вне сайта: ключ Яндекс.Диска и пароль сотрудников.
define('DOGOVORY', 1);
require __DIR__ . '/lib.php';

const SETUP_SHA256 = 'adaa537f4e1cd85de3059210387f26b8f5f85087f3d798228a24529df4725ce5';

header('X-Robots-Tag: noindex, nofollow');
$code = (string)($_SERVER['HTTP_X_SETUP_CODE'] ?? $_POST['code'] ?? '');
$okCode = $code !== '' && hash_equals(SETUP_SHA256, hash('sha256', $code));

// Проверка сервера: PHP, curl, куда пишутся данные, доступ к Диску.
if (isset($_GET['diag'])) {
  if (!$okCode) out_json(['error' => 'Нужен код настройки.'], 403);
  $c = cfg();
  list($yc) = ya('GET', 'https://cloud-api.yandex.net/v1/disk', null, true, 20);
  out_json([
    'php' => PHP_VERSION, 'curl' => function_exists('curl_init'), 'zlib' => function_exists('ob_gzhandler'),
    'data_dir' => data_dir(), 'configured' => (bool)$c['token'], 'password_set' => (bool)$c['pw_hash'],
    'disk_api' => $yc, 'upload_max_filesize' => ini_get('upload_max_filesize'), 'post_max_size' => ini_get('post_max_size'),
    'max_execution_time' => ini_get('max_execution_time'), 'memory_limit' => ini_get('memory_limit'),
    'open_basedir' => ini_get('open_basedir') !== '' ? 'есть' : 'нет',
  ]);
}

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  if (!$okCode) {
    too_many_tries(true);
    $msg = too_many_tries() ? 'Слишком много попыток. Подождите 15 минут.' : 'Неверный код настройки.';
  } elseif (!data_dir()) {
    $msg = 'Хостинг не дал создать папку для настроек.';
  } else {
    $c = cfg();
    $token = trim((string)($_POST['token'] ?? ''));
    $pw = trim((string)($_POST['pw'] ?? ''));
    if ($token !== '') $c['token'] = $token;
    if ($pw !== '') { $c['pw_hash'] = password_hash($pw, PASSWORD_DEFAULT); $c['secret'] = bin2hex(random_bytes(32)); }
    if (!$c['secret']) $c['secret'] = bin2hex(random_bytes(32));
    if (!empty($_POST['root'])) $c['root'] = trim((string)$_POST['root']);
    if (!empty($_POST['start'])) $c['start'] = (int)$_POST['start'];
    if (save_cfg($c)) {
      // cfg() уже закэшировал старые настройки — проверяем ключ напрямую.
      $ch = curl_init('https://cloud-api.yandex.net/v1/disk');
      curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . $c['token']]]);
      curl_exec($ch);
      $yc = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);
      $msg = 'Сохранено. Яндекс.Диск: ' . ($yc === 200 ? 'ключ работает' : 'ключ НЕ работает (' . $yc . ')') . '.';
      if (!empty($_SERVER['HTTP_X_SETUP_CODE'])) out_json(['ok' => true, 'disk' => $yc, 'password_set' => (bool)$c['pw_hash']]);
    } else {
      $msg = 'Не удалось сохранить настройки.';
    }
  }
  if (!empty($_SERVER['HTTP_X_SETUP_CODE'])) out_json(['ok' => false, 'error' => $msg], 400);
}
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Настройка — договоры</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F4F1EC;
         font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1E2A44; }
  form { background: #fff; padding: 28px; border-radius: 16px; width: min(420px, calc(100vw - 32px)); box-sizing: border-box;
         box-shadow: 0 8px 32px rgba(30, 42, 68, .12); }
  h1 { font-size: 20px; margin: 0 0 16px; }
  label { display: block; font-size: 14px; color: #5b6478; margin: 12px 0 4px; }
  input { width: 100%; box-sizing: border-box; font-size: 16px; padding: 10px; border: 1px solid #d7d2c8; border-radius: 10px; }
  button { margin-top: 20px; width: 100%; font-size: 16px; font-weight: 700; padding: 12px; border: 0; border-radius: 10px;
           background: #E0603C; color: #fff; cursor: pointer; }
  .msg { margin-top: 12px; font-size: 14px; }
</style>
</head>
<body>
<form method="post">
  <h1>Настройка программы договоров</h1>
  <label>Код настройки</label>
  <input type="password" name="code" required>
  <label>Ключ Яндекс.Диска (пусто — не менять)</label>
  <input type="password" name="token" autocomplete="off">
  <label>Новый пароль сотрудников (пусто — не менять)</label>
  <input type="text" name="pw" autocomplete="off">
  <button type="submit">Сохранить</button>
  <?php if ($msg) echo '<div class="msg">' . htmlspecialchars($msg) . '</div>'; ?>
</form>
</body>
</html>
