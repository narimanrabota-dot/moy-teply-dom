<?php
// API генератора договоров: /dogovory/api/yadisk/* (страница, только после входа)
// и /dogovory/api/ext/* («Сервис-менеджер», по ключу). Повторяет server.js из репозитория dogovory.
define('DOGOVORY', 1);
require __DIR__ . '/lib.php';

// sha256 ключа «Сервис-менеджера» (сам ключ — в .env закрытого репозитория dogovory).
const EXT_KEY_SHA256 = '3fee23a76966ebdf9a07a6a46977bf147c56e60730cbf14dba3e348f08424070';
const EXT_ORIGIN = 'https://servise-manager.onrender.com';

$route = trim((string)($_GET['r'] ?? ''), '/');
$method = $_SERVER['REQUEST_METHOD'];
$c = cfg();

// ── /api/ext/* ──────────────────────────────────────────────────────────────
if (strpos($route, 'ext/') === 0) {
  header('Access-Control-Allow-Origin: ' . EXT_ORIGIN);
  header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Api-Key');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  if ($method === 'OPTIONS') { http_response_code(204); exit; }
  if (!$c['token']) out_json(['error' => 'Диск не настроен.'], 503);
  $key = trim($_SERVER['HTTP_X_API_KEY'] ?? preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION'] ?? '') ?: ($_GET['key'] ?? ''));
  if (!$key || !hash_equals(EXT_KEY_SHA256, hash('sha256', $key))) out_json(['error' => 'Неверный ключ доступа.'], 401);
  $r = substr($route, 4);

  if ($r === 'next-number') { mkdirp($c['root']); out_json(['next' => next_number()]); }

  // Все заказы: данные из кэша, недостающие дочитываем с Диска (не дольше ~20 с за вызов).
  if ($r === 'orders') {
    $t0 = microtime(true);
    $orders = []; $incomplete = 0;
    foreach (list_names($c['root']) as $folder) {
      if (!preg_match('/^№\s*(\d+)/u', $folder, $m)) continue;
      $data = order_cache_get($folder);
      if ($data === null) {
        if (microtime(true) - $t0 < 20) {
          $txt = download_text($c['root'] . '/' . $folder . '/' . ORDER_JSON);
          $data = $txt !== null ? json_decode($txt, true) : null;
          if ($data) order_cache_put($folder, $data);
        } else $incomplete++;
      }
      $orders[] = ['number' => (int)$m[1], 'folder' => $folder, 'data' => $data ?: null];
    }
    usort($orders, function ($a, $b) { return $b['number'] - $a['number']; });
    out_json($incomplete ? ['orders' => $orders, 'incomplete' => $incomplete] : ['orders' => $orders]);
  }

  if (preg_match('~^order/(.+)$~u', $r, $m)) {
    $raw = trim(rawurldecode($m[1]));
    $re = '/^№\s*' . preg_quote($raw, '/') . '(\D|$)/u';
    $folder = null;
    foreach (list_names($c['root']) as $n) if (preg_match($re, $n)) { $folder = $n; break; }
    if (!$folder) out_json(['found' => false]);
    $full = $c['root'] . '/' . $folder;
    $txt = download_text($full . '/' . ORDER_JSON);
    $data = $txt !== null ? json_decode($txt, true) : null;
    if ($data) order_cache_put($folder, $data);
    out_json(['found' => true, 'number' => (int)$raw, 'folder' => $folder, 'url' => public_url($full), 'data' => $data ?: null]);
  }
  out_json(['error' => 'Нет такого адреса.'], 404);
}

// ── /api/yadisk/* — только после входа по паролю компании ────────────────────
if (strpos($route, 'yadisk/') !== 0) out_json(['error' => 'Нет такого адреса.'], 404);
if (!logged_in()) out_json(['error' => 'Нужно войти в программу.'], 401);
$r = substr($route, 7);

if ($r === 'status') out_json(['configured' => (bool)$c['token'], 'root' => $c['root']]);
if (!$c['token']) {
  if ($r === 'log') out_json(['ok' => false]);
  out_json(['error' => $r === 'file' ? 'Яндекс.Диск не настроен на сервере.' : 'Диск не настроен.'], 503);
}
$body = function () { return json_decode((string)file_get_contents('php://input'), true) ?: []; };

if ($r === 'next-number' && $method === 'GET') { mkdirp($c['root']); out_json(['next' => next_number()]); }

if ($r === 'folder' && $method === 'GET') {
  $folder = clean_seg(rawurldecode($_GET['name'] ?? ''));
  if (!$folder) out_json(['exists' => false, 'files' => []]);
  $names = list_names($c['root'] . '/' . $folder);
  out_json(['exists' => count($names) > 0, 'files' => $names]);
}

// Загрузка одного файла: тело — сырые байты, папка и имя — в заголовках X-Folder / X-Name.
if ($r === 'file' && ($method === 'PUT' || $method === 'POST')) {
  @set_time_limit(0);
  ignore_user_abort(true);
  $folder = clean_path(rawurldecode($_SERVER['HTTP_X_FOLDER'] ?? ''));
  $name = clean_seg(rawurldecode($_SERVER['HTTP_X_NAME'] ?? '')) ?: 'файл';
  if (!$folder) out_json(['error' => 'Не указана папка (X-Folder).'], 400);
  $dir = $c['root'] . '/' . $folder;
  mkdirp($dir);
  $dst = $dir . '/' . $name;

  list($code, $j) = ya_json('GET', YA . '/upload?overwrite=true&path=' . p($dst));
  if ($code === 401) out_json(['error' => 'Ключ Яндекс.Диска недействителен — обновите его в setup.php.'], 401);
  if ($code === 507) out_json(['error' => 'На Яндекс.Диске закончилось место.'], 507);
  if ($code !== 200 || empty($j['href'])) out_json(['error' => 'Не удалось получить ссылку загрузки (' . $code . ').'], 502);

  // Тело передаём потоком из php://input, не держа файл в памяти.
  $in = fopen('php://input', 'rb');
  $tmp = fopen('php://temp/maxmemory:8388608', 'w+b');
  $size = stream_copy_to_stream($in, $tmp);
  fclose($in);
  rewind($tmp);
  if ($name === ORDER_JSON && $size < 5000000) {
    $data = json_decode(stream_get_contents($tmp), true);
    if ($data) order_cache_put(explode('/', $folder)[0], $data);
    rewind($tmp);
  }
  $ch = curl_init($j['href']);
  curl_setopt_array($ch, [
    CURLOPT_UPLOAD => true, CURLOPT_INFILE => $tmp, CURLOPT_INFILESIZE => $size,
    CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => 0,
  ]);
  curl_exec($ch);
  $put = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  fclose($tmp);
  if (!in_array($put, [200, 201, 202], true)) out_json(['error' => 'Ошибка загрузки на Диск (' . $put . ').'], 502);

  // Проверка целостности: файл появился и размер совпал.
  list($cc, $cj) = ya_json('GET', YA . '?path=' . p($dst) . '&fields=size');
  $got = $cc === 200 && isset($cj['size']) ? (int)$cj['size'] : null;
  out_json(['ok' => true, 'path' => $dst, 'verified' => $got === $size, 'size' => $got]);
}

// Одноразовая ссылка загрузки: браузер кладёт файл прямо в Диск (быстрее, чем через хостинг).
if ($r === 'upload-link' && $method === 'POST') {
  $b = $body();
  $folder = clean_path($b['folder'] ?? '');
  $name = clean_seg($b['name'] ?? '') ?: 'файл';
  if (!$folder) out_json(['error' => 'Не указана папка.'], 400);
  $dir = $c['root'] . '/' . $folder;
  mkdirp($dir);
  $dst = $dir . '/' . $name;
  list($code, $j) = ya_json('GET', YA . '/upload?overwrite=true&path=' . p($dst));
  if ($code === 401) out_json(['error' => 'Ключ Яндекс.Диска недействителен — обновите его в setup.php.'], 401);
  if ($code === 507) out_json(['error' => 'На Яндекс.Диске закончилось место.'], 507);
  if ($code !== 200 || empty($j['href'])) out_json(['error' => 'Не удалось получить ссылку загрузки (' . $code . ').'], 502);
  out_json(['href' => $j['href'], 'path' => $dst]);
}

// Проверка после прямой загрузки: файл есть и размер совпал (Диск может дописывать пару секунд).
if ($r === 'verify' && $method === 'POST') {
  $b = $body();
  $path = (string)($b['path'] ?? '');
  $want = (int)($b['size'] ?? -1);
  if (strpos($path, $c['root'] . '/') !== 0) out_json(['error' => 'Чужой путь.'], 400);
  $got = null;
  for ($i = 0; $i < 4; $i++) {
    list($cc, $cj) = ya_json('GET', YA . '?path=' . p($path) . '&fields=size');
    $got = $cc === 200 && isset($cj['size']) ? (int)$cj['size'] : null;
    if ($got === $want) break;
    sleep(1);
  }
  out_json(['verified' => $got === $want, 'size' => $got]);
}

if ($r === 'publish' && $method === 'POST') {
  $folder = clean_path($body()['folder'] ?? '');
  if (!$folder) out_json(['error' => 'Не указана папка.'], 400);
  out_json(['url' => public_url($c['root'] . '/' . $folder)]);
}

// Журнал: строка «дата;номер;ФИО;менеджер;событие» дописывается в ROOT/_журнал.csv.
if ($r === 'log' && $method === 'POST') {
  $b = $body();
  $esc = function ($s) { return preg_replace('/[;\r\n]/u', ' ', (string)$s); };
  $line = implode(';', [gmdate('Y-m-d H:i:s'), $esc($b['num'] ?? ''), $esc($b['fio'] ?? ''), $esc($b['manager'] ?? ''), $esc(($b['event'] ?? '') ?: 'залито')]) . "\n";
  $logPath = $c['root'] . '/_журнал.csv';
  $prev = download_text($logPath);
  if (!$prev) $prev = "дата;номер;ФИО;менеджер;событие\n";
  mkdirp($c['root']);
  list($code, $j) = ya_json('GET', YA . '/upload?overwrite=true&path=' . p($logPath));
  if ($code === 200 && !empty($j['href'])) ya('PUT', $j['href'], $prev . $line, false);
  out_json(['ok' => true]);
}

if ($r === 'find-order' && $method === 'GET') {
  $num = trim((string)($_GET['num'] ?? ''));
  if ($num === '') out_json(['folder' => null]);
  $re = '/^№\s*' . preg_quote($num, '/') . '(\D|$)/u';
  foreach (list_names($c['root']) as $n) if (preg_match($re, $n)) out_json(['folder' => $n]);
  out_json(['folder' => null]);
}

// Удалить подпапку целиком (в Корзину).
if ($r === 'clear' && $method === 'POST') {
  $folder = clean_path($body()['folder'] ?? '');
  if (!$folder) out_json(['error' => 'Не указана папка.'], 400);
  ya('DELETE', YA . '?path=' . p($c['root'] . '/' . $folder) . '&permanently=false');
  out_json(['ok' => true]);
}

// Удалить в папке файлы, чьё имя начинается на prefix (в Корзину).
if ($r === 'clear-prefix' && $method === 'POST') {
  $b = $body();
  $folder = clean_path($b['folder'] ?? '');
  $prefix = (string)($b['prefix'] ?? '');
  if (!$folder || $prefix === '') out_json(['error' => 'Нужны folder и prefix.'], 400);
  $full = $c['root'] . '/' . $folder;
  foreach (list_names($full) as $n) {
    if (strpos($n, $prefix) === 0) ya('DELETE', YA . '?path=' . p($full . '/' . $n) . '&permanently=false');
  }
  out_json(['ok' => true]);
}

out_json(['error' => 'Нет такого адреса.'], 404);
