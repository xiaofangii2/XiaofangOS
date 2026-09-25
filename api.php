<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Target-Path');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);
$ROOT = __DIR__;
$action = $_GET['action'] ?? $_POST['action'] ?? '';
function safe_path($root, $rel) {
    $rel = ltrim($rel, '/');
    if (strpos($rel, '..') !== false) return null;
    return $root . '/' . $rel;
}
function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function unique_dest($path) {
    if (!file_exists($path)) return $path;
    $info = pathinfo($path);
    $base = $info['dirname'] . '/' . $info['filename'];
    $ext = isset($info['extension']) ? '.' . $info['extension'] : '';
    $i = 1;
    while (file_exists($base . '(' . $i . ')' . $ext)) $i++;
    return $base . '(' . $i . ')' . $ext;
}
function rm_recursive($path) {
    if (is_dir($path)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) { $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname()); }
        rmdir($path);
    } else { unlink($path); }
}
function parse_conf($content) {
    $r = ['author'=>'','id'=>'','version'=>'','introduce'=>''];
    foreach (preg_split('/\r?\n/', $content) as $line) {
        $i = strpos($line, ':');
        if ($i > 0) {
            $k = strtolower(trim(substr($line, 0, $i)));
            $v = trim(substr($line, $i + 1));
            if (array_key_exists($k, $r)) $r[$k] = $v;
        }
    }
    return $r;
}
function read_xfapp_conf($path) {
    if (!class_exists('ZipArchive')) return null;
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return null;
    $confIdx = $zip->locateName('XiaofangOS.conf');
    if ($confIdx === false) { $zip->close(); return null; }
    $conf = $zip->getFromIndex($confIdx);
    $zip->close();
    return parse_conf($conf);
}
function cmp_version($a, $b) {
    $pa = array_map('intval', explode('.', $a));
    $pb = array_map('intval', explode('.', $b));
    $n = max(count($pa), count($pb));
    for ($i = 0; $i < $n; $i++) {
        $x = $pa[$i] ?? 0; $y = $pb[$i] ?? 0;
        if ($x < $y) return -1;
        if ($x > $y) return 1;
    }
    return 0;
}
switch ($action) {
    case 'list':
        $rel = $_GET['path'] ?? '';
        $target = safe_path($ROOT, $rel);
        if (!$target || !is_dir($target)) json_out(['error' => 'not a dir'], 404);
        $items = [];
        foreach (scandir($target) as $f) {
            if ($f === '.' || $f === '..') continue;
            $full = $target . '/' . $f;
            $items[] = [
                'name' => $f,
                'isDir' => is_dir($full),
                'size' => is_file($full) ? filesize($full) : 0,
                'mtime' => filemtime($full)
            ];
        }
        json_out(['ok' => true, 'items' => $items]);
    case 'install':
        $target = $_SERVER['HTTP_X_TARGET_PATH'] ?? '';
        if (!$target) json_out(['error' => 'no target'], 400);
        $path = safe_path($ROOT, $target);
        if (!$path) json_out(['error' => 'bad path'], 400);
        $dir = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $data = file_get_contents('php://input');
        if ($data === false) json_out(['error' => 'read fail'], 500);
        $ok = file_put_contents($path, $data);
        if ($ok === false) json_out(['error' => 'write fail'], 500);
        json_out(['ok' => true, 'size' => $ok]);
    case 'install_check':
        $input = json_decode(file_get_contents('php://input'), true);
        $src = safe_path($ROOT, $input['src'] ?? '');
        if (!$src || !file_exists($src)) json_out(['error' => 'source not found'], 404);
        $newConf = read_xfapp_conf($src);
        if (!$newConf || !$newConf['id']) json_out(['error' => 'conf 里没有 id'], 400);
        $newId = $newConf['id'];
        $dstIdDir = $ROOT . '/Ubuntu/mnt/data/' . $newId . '.xfapp';
        $base = ['ok' => true, 'id' => $newId, 'newVersion' => $newConf['version']];
        if (!file_exists($dstIdDir)) {
            json_out(array_merge($base, ['decision' => 'install', 'reason' => 'new']));
        }
        $oldConf = read_xfapp_conf($dstIdDir);
        if (!$oldConf || !$oldConf['version']) {
            json_out(array_merge($base, ['decision' => 'install', 'reason' => 'old_no_version']));
        }
        $base['oldVersion'] = $oldConf['version'];
        $c = cmp_version($oldConf['version'], $newConf['version']);
        if ($c > 0) json_out(array_merge($base, ['decision' => 'fail', 'reason' => 'has_newer']));
        elseif ($c < 0) json_out(array_merge($base, ['decision' => 'install', 'reason' => 'upgrade']));
        else json_out(array_merge($base, ['decision' => 'install', 'reason' => 'same_version']));
    case 'rename':
        $input = json_decode(file_get_contents('php://input'), true);
        $from = safe_path($ROOT, $input['from'] ?? '');
        $to = safe_path($ROOT, $input['to'] ?? '');
        if (!$from || !$to || !file_exists($from)) json_out(['error' => 'bad'], 400);
        if (file_exists($to)) json_out(['error' => '目标已存在'], 409);
        if (!rename($from, $to)) json_out(['error' => 'rename fail'], 500);
        json_out(['ok' => true]);
    case 'delete':
        $input = json_decode(file_get_contents('php://input'), true);
        $target = safe_path($ROOT, $input['target'] ?? '');
        if (!$target || !file_exists($target)) json_out(['error' => 'not found'], 404);
        rm_recursive($target);
        json_out(['ok' => true]);
    case 'trash':
        $input = json_decode(file_get_contents('php://input'), true);
        $target = safe_path($ROOT, $input['target'] ?? '');
        if (!$target || !file_exists($target)) json_out(['error' => 'not found'], 404);
        $base = basename($target);
        $recycleDir = $ROOT . '/recycle-bin';
        if (!is_dir($recycleDir)) mkdir($recycleDir, 0755, true);
        $dst = unique_dest($recycleDir . '/' . $base);
        if (!rename($target, $dst)) json_out(['error' => 'move fail'], 500);
        json_out(['ok' => true, 'name' => basename($dst)]);
    case 'empty_trash':
        $recycleDir = $ROOT . '/recycle-bin';
        if (!is_dir($recycleDir)) json_out(['ok' => true]);
        foreach (scandir($recycleDir) as $f) {
            if ($f === '.' || $f === '..') continue;
            rm_recursive($recycleDir . '/' . $f);
        }
        json_out(['ok' => true]);
    case 'restore':
        $input = json_decode(file_get_contents('php://input'), true);
        $target = safe_path($ROOT, $input['target'] ?? '');
        if (!$target || !file_exists($target)) json_out(['error' => 'not found'], 404);
        $base = basename($target);
        $dstDir = $ROOT . '/home';
        if (!is_dir($dstDir)) mkdir($dstDir, 0755, true);
        $dst = unique_dest($dstDir . '/' . $base);
        if (!rename($target, $dst)) json_out(['error' => 'restore fail'], 500);
        json_out(['ok' => true, 'name' => basename($dst)]);
    case 'mkdir':
        $input = json_decode(file_get_contents('php://input'), true);
        $target = safe_path($ROOT, $input['path'] ?? '');
        if (!$target) json_out(['error' => 'bad'], 400);
        if (file_exists($target)) json_out(['error' => '已存在'], 409);
        if (!mkdir($target, 0755, true)) json_out(['error' => 'fail'], 500);
        json_out(['ok' => true]);
    case 'mkfile':
        $input = json_decode(file_get_contents('php://input'), true);
        $target = safe_path($ROOT, $input['path'] ?? '');
        if (!$target) json_out(['error' => 'bad'], 400);
        if (file_exists($target)) json_out(['error' => '已存在'], 409);
        $dir = dirname($target);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        if (file_put_contents($target, '') === false) json_out(['error' => 'fail'], 500);
        json_out(['ok' => true]);
    default:
        json_out(['error' => 'unknown action'], 400);
}