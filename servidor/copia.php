<?php
// Copia automática de Tirador Deportivo en tu propio hosting.
// Guarda el archivo de copia que manda la app, ya cifrado en el móvil con tu contraseña:
// aquí solo hay datos ilegibles. La CLAVE impide que otro suba o descargue copias.
//
// Instalación: sube este archivo a una carpeta de tu web (por ejemplo /tirador/copia.php),
// cambia CLAVE por la que te da la app y abre https://tudominio/tirador/copia.php para comprobarlo.

const CLAVE = 'CAMBIAR-POR-TU-CLAVE';
const ORIGENES = ['https://potox42.github.io'];
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB
const VERSIONES = 5; // se guardan las últimas 5 copias

$dir = __DIR__ . '/copias';
if (!is_dir($dir)) {
    mkdir($dir, 0700, true);
}
// Que nadie pueda descargar la carpeta directamente desde el navegador.
if (!file_exists("$dir/.htaccess")) {
    file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
}

$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origen, ORIGENES, true)) {
    header("Access-Control-Allow-Origin: $origen");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: X-Clave, Content-Type');
    header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Cache-Control: no-store');

function responder(int $codigo, array $datos): void
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos);
    exit;
}

function copias(string $dir): array
{
    $lista = glob("$dir/copia-*.tirador") ?: [];
    sort($lista);
    return $lista;
}

$clave = $_SERVER['HTTP_X_CLAVE'] ?? '';
if ($clave === '') {
    // Abierto desde el navegador: solo dice si está bien instalado.
    $ok = CLAVE !== 'CAMBIAR-POR-TU-CLAVE' && is_writable($dir);
    responder($ok ? 200 : 500, ['instalado' => $ok, 'mensaje' => $ok ? 'Listo para recibir copias.' : 'Falta cambiar la CLAVE o la carpeta copias no se puede escribir.']);
}
if (CLAVE === 'CAMBIAR-POR-TU-CLAVE' || !hash_equals(CLAVE, $clave)) {
    responder(403, ['error' => 'Clave incorrecta.']);
}

$accion = $_GET['accion'] ?? 'info';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cuerpo = file_get_contents('php://input', false, null, 0, MAX_BYTES + 1);
    if ($cuerpo === false || $cuerpo === '') {
        responder(400, ['error' => 'No ha llegado la copia (puede que sea más grande de lo que admite el servidor).']);
    }
    if (strlen($cuerpo) > MAX_BYTES) {
        responder(413, ['error' => 'La copia es demasiado grande.']);
    }
    $json = json_decode($cuerpo, true);
    if (!is_array($json) || ($json['app'] ?? '') !== 'tirador' || !isset($json['cifrado'])) {
        responder(400, ['error' => 'Esto no es una copia de Tirador Deportivo.']);
    }
    $nombre = $dir . '/copia-' . gmdate('Ymd-His') . '.tirador';
    if (file_put_contents($nombre, $cuerpo, LOCK_EX) === false) {
        responder(500, ['error' => 'No se pudo guardar la copia en el servidor.']);
    }
    $lista = copias($dir);
    while (count($lista) > VERSIONES) {
        unlink(array_shift($lista));
    }
    responder(200, ['ok' => true, 'fecha' => gmdate('c'), 'bytes' => strlen($cuerpo)]);
}

$lista = copias($dir);
if ($accion === 'bajar') {
    if (!$lista) {
        responder(404, ['error' => 'Aún no hay ninguna copia en el servidor.']);
    }
    $ultima = end($lista);
    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($ultima));
    readfile($ultima);
    exit;
}
$ultima = $lista ? end($lista) : null;
responder(200, [
    'copias' => count($lista),
    'fecha' => $ultima ? gmdate('c', filemtime($ultima)) : null,
    'bytes' => $ultima ? filesize($ultima) : 0,
]);
