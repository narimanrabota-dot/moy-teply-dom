<?php
// Вход в генератор договоров. Общего пароля нет (владелец, 15.10.2026: «сотрудник сам задаёт
// свой пароль» — это код из 3 цифр внутри самой программы). При первом открытии страница
// выдаёт браузеру подписанную cookie на год: без неё API Диска не отвечает, так что напрямую,
// мимо страницы программы, на Диск ничего не записать.
define('DOGOVORY', 1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');

$f = (string)($_GET['f'] ?? '');
if (!logged_in()) {
  if ($f === 'assets.js') { http_response_code(401); exit; }
  set_login_cookie();
}

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
