<?php
// Генератор договоров «Мой тёплый дом» на хостинге REG.RU — общие функции.
// Исходник программы — закрытый репозиторий narimanrabota-dot/dogovory, сюда её
// кладёт tools/deploy_regru.sh. Руками файлы в этой папке не править.
//
// Секреты (ключ Яндекс.Диска, пароль сотрудников) в git не лежат: их один раз
// записывает setup.php в папку данных ВНЕ сайта (~/dogovory-data), её не трогает выкладка.

if (!defined('DOGOVORY')) { http_response_code(404); exit; }

const YA = 'https://cloud-api.yandex.net/v1/disk/resources';
const ORDER_JSON = '_данные заказа.json';
const COOKIE = 'mtd_dogovory';
const COOKIE_DAYS = 365;

// Папка данных: сначала домашняя папка хостинга (вне сайта), потом запасные варианты.
function data_dir() {
  static $dir = null;
  if ($dir !== null) return $dir;
  $doc = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
  $cands = [dirname(dirname($doc)) . '/dogovory-data', dirname($doc) . '/dogovory-data', __DIR__ . '/_data'];
  foreach ($cands as $c) {
    if (@is_dir($c) && @is_writable($c)) return $dir = $c;
  }
  foreach ($cands as $c) {
    if (@mkdir($c, 0700, true) && @is_writable($c)) {
      if ($c === __DIR__ . '/_data') @file_put_contents($c . '/.htaccess', "Require all denied\n");
      return $dir = $c;
    }
  }
  return $dir = '';
}

function cfg() {
  static $c = null;
  if ($c !== null) return $c;
  $d = data_dir();
  $f = $d ? $d . '/config.json' : '';
  $c = ($f && is_file($f)) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
  $c += ['token' => '', 'root' => 'disk:/Заказы 2.0', 'start' => 100, 'pw_hash' => '', 'secret' => ''];
  $c['root'] = rtrim($c['root'], '/');
  return $c;
}

function save_cfg(array $c) {
  $d = data_dir();
  if (!$d) return false;
  $ok = file_put_contents($d . '/config.json', json_encode($c, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) !== false;
  @chmod($d . '/config.json', 0600);
  return $ok;
}

// ── вход сотрудников: пароль компании → подписанная cookie на год ─────────────
function sign_cookie($exp) {
  return $exp . '.' . hash_hmac('sha256', 'dogovory|' . $exp, cfg()['secret']);
}
function logged_in() {
  $c = cfg();
  if (!$c['secret'] || !$c['pw_hash']) return false;
  $v = $_COOKIE[COOKIE] ?? '';
  if (!preg_match('/^(\d+)\.([0-9a-f]{64})$/', $v, $m)) return false;
  if ((int)$m[1] < time()) return false;
  return hash_equals(sign_cookie($m[1]), $v);
}
function set_login_cookie() {
  $exp = time() + COOKIE_DAYS * 86400;
  setcookie(COOKIE, sign_cookie($exp), [
    'expires' => $exp, 'path' => '/dogovory/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax',
  ]);
}

// Не больше 8 неверных паролей с одного адреса за 15 минут.
function too_many_tries($fail = false) {
  $d = data_dir();
  if (!$d) return false;
  $f = $d . '/tries.json';
  $all = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
  $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
  $now = time();
  foreach ($all as $k => $v) if ($v['t'] < $now - 900) unset($all[$k]);
  if ($fail) { $all[$ip] = ['n' => ($all[$ip]['n'] ?? 0) + 1, 't' => $now]; file_put_contents($f, json_encode($all), LOCK_EX); }
  return ($all[$ip]['n'] ?? 0) >= 8;
}

// ── Яндекс.Диск ──────────────────────────────────────────────────────────────
// Запрос к API Диска (или по ссылке загрузки/скачивания). Возвращает [код, тело].
function ya($method, $url, $body = null, $auth = true, $timeout = 60) {
  $ch = curl_init($url);
  $h = [];
  if ($auth) $h[] = 'Authorization: OAuth ' . cfg()['token'];
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_TIMEOUT => $timeout, CURLOPT_HTTPHEADER => $h,
  ]);
  // PUT/DELETE без тела — с Content-Length: 0 (иначе часть серверов отвечает 411).
  if ($body !== null || $method !== 'GET') curl_setopt($ch, CURLOPT_POSTFIELDS, $body === null ? '' : $body);
  $res = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return [$code, $res === false ? '' : $res];
}
function ya_json($method, $url, $body = null) {
  list($code, $res) = ya($method, $url, $body);
  return [$code, json_decode($res, true) ?: []];
}
function p($path) { return rawurlencode($path); }

function clean_seg($s) {
  $s = preg_replace('/[\\\\\/:*?"<>|]/u', '-', (string)$s);
  $s = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE00}-\x{FE0F}\x{200D}]/u', '', $s);
  return trim(preg_replace('/\s+/u', ' ', $s));
}
function clean_path($s) {
  return implode('/', array_values(array_filter(array_map('clean_seg', explode('/', (string)$s)), 'strlen')));
}

function mkdirp($full) {
  if (!preg_match('~^([a-z]+:/)(.*)$~i', $full, $m)) $m = [null, '', $full];
  $acc = $m[1];
  foreach (array_filter(explode('/', $m[2]), 'strlen') as $s) {
    $acc = substr($acc, -1) === '/' ? $acc . $s : $acc . '/' . $s;
    ya('PUT', YA . '?path=' . p($acc), null, true, 20);
  }
}

function list_names($folder) {
  list($code, $j) = ya_json('GET', YA . '?path=' . p($folder) . '&limit=1000&fields=' . p('_embedded.items.name,_embedded.items.type,type'));
  if ($code !== 200) return [];
  $out = [];
  foreach (($j['_embedded']['items'] ?? []) as $it) $out[] = $it['name'];
  return $out;
}

function next_number() {
  $c = cfg();
  $max = (int)$c['start'] - 1;
  foreach (list_names($c['root']) as $n) if (preg_match('/№\s*(\d+)/u', $n, $m)) $max = max($max, (int)$m[1]);
  return max($max + 1, (int)$c['start']);
}

function download_text($full) {
  list($code, $j) = ya_json('GET', YA . '/download?path=' . p($full));
  if ($code !== 200 || empty($j['href'])) return null;
  list($c2, $res) = ya('GET', $j['href'], null, false, 60);
  return $c2 === 200 ? $res : null;
}

function public_url($full) {
  ya('PUT', YA . '/publish?path=' . p($full));
  list($code, $j) = ya_json('GET', YA . '?path=' . p($full) . '&fields=public_url');
  return $j['public_url'] ?? '';
}

// Кэш «данных заказа» для «Сервис-менеджера» (папка данных/orders).
function order_cache_put($folder, $data) {
  $d = data_dir();
  if (!$d || !$folder) return;
  @mkdir($d . '/orders', 0700);
  file_put_contents($d . '/orders/' . md5($folder) . '.json', json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
}
function order_cache_get($folder) {
  $d = data_dir();
  $f = $d . '/orders/' . md5($folder) . '.json';
  if (!$d || !is_file($f)) return null;
  return json_decode((string)file_get_contents($f), true);
}

function out_json($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
