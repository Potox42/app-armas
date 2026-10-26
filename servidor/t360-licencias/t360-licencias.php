<?php
/**
 * Plugin Name: Tirador 360 · Licencias
 * Description: Comprueba desde la app los códigos de compra (License Manager for WooCommerce) y une cada código a un solo móvil.
 * Version: 1.0.0
 * Author: Soluciones Técnicas y Ambientales de Ozono, S.L.U.
 * Requires PHP: 8.0
 */

// Cómo funciona:
// - La app manda el código (T360B-… / T360P-…) y un identificador aleatorio de ese móvil.
// - La primera vez el código se une a ese móvil. Desde otro móvil sale «en uso».
// - Para cambiar de móvil: «Liberar licencia» en la app, o «Usarla en este móvil» (como mucho MOVIMIENTOS_ANO veces al año).
// - Rubén puede soltar un código a mano en WooCommerce › Tirador 360 · móviles (por ejemplo, si a alguien le roban el móvil).
// No usa claves de la API: llama por dentro a las funciones de License Manager.

if (!defined('ABSPATH')) exit;

const T360L_ORIGENES = [
    'https://potox42.github.io',
    'https://tirador360.es',
    'https://www.tirador360.es',
    'https://tirador3602164.live-website.com',
];
const T360L_SKU = ['T360-BASICA' => 'basica', 'T360-PRO' => 'pro'];
const T360L_ESTADO_DESACTIVADA = 5; // LicenseStatus::DISABLED de License Manager
const T360L_MOVIMIENTOS_ANO = 3;
const T360L_PETICIONES_HORA = 30;

/** Datos guardados por licencia: móvil unido y cambios de móvil del último año. */
function t360l_leer(int $id): array
{
    $d = get_option("t360l_$id", []);
    return is_array($d) ? $d : [];
}
function t360l_guardar(int $id, array $d): void
{
    update_option("t360l_$id", $d, false);
}

function t360l_respuesta(array $datos, int $codigo = 200): WP_REST_Response
{
    $r = new WP_REST_Response($datos, $codigo);
    $r->header('Cache-Control', 'no-store');
    return $r;
}

function t360l_fallo(string $motivo, array $extra = []): WP_REST_Response
{
    return t360l_respuesta(['ok' => false, 'motivo' => $motivo] + $extra);
}

/** Valida el código y devuelve [licencia, edición] o una respuesta de error. */
function t360l_licencia(string $codigo)
{
    if (!function_exists('lmfwc_get_license')) return t360l_fallo('error');
    if (!preg_match('/^T360[BP]-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $codigo)) return t360l_fallo('no_existe');
    $lic = lmfwc_get_license($codigo);
    if (!$lic) return t360l_fallo('no_existe');
    if ((int) $lic->getStatus() === T360L_ESTADO_DESACTIVADA) return t360l_fallo('desactivada');
    $caduca = $lic->getExpiresAt();
    if ($caduca && strtotime($caduca) < time()) return t360l_fallo('desactivada');
    $producto = function_exists('wc_get_product') ? wc_get_product($lic->getProductId()) : null;
    $sku = $producto ? $producto->get_sku() : '';
    $edicion = T360L_SKU[$sku] ?? (str_starts_with($codigo, 'T360P-') ? 'pro' : 'basica');
    return [$lic, $edicion];
}

function t360l_amigo($lic): string
{
    $pedido = function_exists('wc_get_order') ? wc_get_order($lic->getOrderId()) : null;
    return $pedido ? (string) $pedido->get_meta('_t360_codigo_amigo') : '';
}

/** Avisa a License Manager del uso (contador de activaciones); si falla, no bloquea la app. */
function t360l_lm(string $f, string $codigo): void
{
    if (!function_exists($f)) return;
    try { $f($codigo); } catch (Throwable $e) { /* el móvil unido lo controla este plugin */ }
}

function t360l_ok($lic, string $edicion): WP_REST_Response
{
    return t360l_respuesta(['ok' => true, 'edicion' => $edicion, 'amigo' => t360l_amigo($lic)]);
}

/** Pocas peticiones por hora y por IP, para que no se puedan probar códigos a ciegas. */
function t360l_limite(): bool
{
    $clave = 't360l_ip_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $n = (int) get_transient($clave);
    if ($n >= T360L_PETICIONES_HORA) return false;
    set_transient($clave, $n + 1, HOUR_IN_SECONDS);
    return true;
}

function t360l_entrada(WP_REST_Request $p): array
{
    $codigo = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string) $p->get_param('codigo')));
    $disp = preg_replace('/[^a-f0-9-]/', '', strtolower((string) $p->get_param('dispositivo')));
    return [$codigo, substr($disp, 0, 64)];
}

function t360l_activar(WP_REST_Request $p): WP_REST_Response
{
    if (!t360l_limite()) return t360l_respuesta(['ok' => false, 'motivo' => 'demasiados'], 429);
    [$codigo, $disp] = t360l_entrada($p);
    if (strlen($disp) < 16) return t360l_fallo('error');
    $v = t360l_licencia($codigo);
    if ($v instanceof WP_REST_Response) return $v;
    [$lic, $edicion] = $v;
    $id = (int) $lic->getId();
    $d = t360l_leer($id);
    if (($d['disp'] ?? '') === $disp) return t360l_ok($lic, $edicion);

    $hace_un_ano = time() - YEAR_IN_SECONDS;
    $movs = array_values(array_filter($d['movs'] ?? [], fn($t) => $t > $hace_un_ano));
    if (!empty($d['disp'])) {
        $puede = count($movs) < T360L_MOVIMIENTOS_ANO;
        if (!$p->get_param('mover') || !$puede) return t360l_fallo('en_uso', ['puede_mover' => $puede]);
        $movs[] = time();
        t360l_lm('lmfwc_deactivate_license', $codigo);
    }
    t360l_lm('lmfwc_activate_license', $codigo);
    t360l_guardar($id, ['disp' => $disp, 'desde' => time(), 'movs' => $movs]);
    if (function_exists('wc_get_order') && ($pedido = wc_get_order($lic->getOrderId()))) {
        $pedido->add_order_note(empty($d['disp']) ? 'Licencia activada en un móvil.' : 'Licencia pasada a otro móvil desde la app.');
    }
    return t360l_ok($lic, $edicion);
}

function t360l_comprobar(WP_REST_Request $p): WP_REST_Response
{
    if (!t360l_limite()) return t360l_respuesta(['ok' => false, 'motivo' => 'demasiados'], 429);
    [$codigo, $disp] = t360l_entrada($p);
    $v = t360l_licencia($codigo);
    if ($v instanceof WP_REST_Response) return $v;
    [$lic, $edicion] = $v;
    $d = t360l_leer((int) $lic->getId());
    if (($d['disp'] ?? '') !== $disp || $disp === '') return t360l_fallo('otro_movil');
    return t360l_ok($lic, $edicion);
}

function t360l_liberar(WP_REST_Request $p): WP_REST_Response
{
    if (!t360l_limite()) return t360l_respuesta(['ok' => false, 'motivo' => 'demasiados'], 429);
    [$codigo, $disp] = t360l_entrada($p);
    $v = t360l_licencia($codigo);
    if ($v instanceof WP_REST_Response) return $v;
    [$lic] = $v;
    $id = (int) $lic->getId();
    $d = t360l_leer($id);
    if (($d['disp'] ?? '') !== $disp || $disp === '') return t360l_fallo('otro_movil');
    t360l_lm('lmfwc_deactivate_license', $codigo);
    unset($d['disp'], $d['desde']);
    t360l_guardar($id, $d);
    return t360l_respuesta(['ok' => true]);
}

add_action('rest_api_init', function () {
    foreach (['activar', 'comprobar', 'liberar'] as $accion) {
        register_rest_route('t360/v1', "/$accion", [
            'methods' => 'POST',
            'callback' => "t360l_$accion",
            'permission_callback' => '__return_true',
        ]);
    }
});

// Solo la app (y la web) pueden llamar desde el navegador.
add_filter('rest_pre_serve_request', function ($servido, $resultado, $peticion) {
    if (strpos($peticion->get_route(), '/t360/v1/') !== 0) return $servido;
    $origen = get_http_origin();
    if ($origen && in_array($origen, T360L_ORIGENES, true)) {
        header("Access-Control-Allow-Origin: $origen");
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }
    return $servido;
}, 10, 3);

// ---------- Página para Rubén: ver y soltar el móvil de un código ----------
add_action('admin_menu', function () {
    add_submenu_page('woocommerce', 'Tirador 360 · móviles', 'Tirador 360 · móviles', 'manage_woocommerce', 't360-moviles', 't360l_pagina');
});

function t360l_pagina(): void
{
    if (!current_user_can('manage_woocommerce')) return;
    $codigo = strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string) ($_POST['codigo'] ?? $_GET['codigo'] ?? '')));
    $mensaje = '';
    $lic = $codigo && function_exists('lmfwc_get_license') ? lmfwc_get_license($codigo) : null;
    if ($lic && isset($_POST['soltar']) && check_admin_referer('t360l_soltar')) {
        $d = t360l_leer((int) $lic->getId());
        if (!empty($d['disp'])) t360l_lm('lmfwc_deactivate_license', $codigo);
        unset($d['disp'], $d['desde']);
        t360l_guardar((int) $lic->getId(), $d);
        $mensaje = 'Hecho: el código ya se puede activar en otro móvil.';
    }
    echo '<div class="wrap"><h1>Tirador 360 · móviles</h1>';
    echo '<p>Escribe un código de licencia para ver si está unido a un móvil y, si hace falta, soltarlo (por ejemplo, si a un cliente le han robado el móvil).</p>';
    if ($mensaje) echo '<div class="notice notice-success"><p>' . esc_html($mensaje) . '</p></div>';
    echo '<form method="post"><input name="codigo" value="' . esc_attr($codigo) . '" placeholder="T360P-XXXX-XXXX-XXXX" style="width:260px"> ';
    submit_button('Buscar', 'secondary', 'buscar', false);
    echo '</form>';
    if ($codigo) {
        if (!$lic) {
            echo '<p><strong>Ese código no existe.</strong></p>';
        } else {
            $d = t360l_leer((int) $lic->getId());
            $movs = count(array_filter($d['movs'] ?? [], fn($t) => $t > time() - YEAR_IN_SECONDS));
            echo '<p>Pedido: #' . (int) $lic->getOrderId() . '<br>';
            echo empty($d['disp'])
                ? 'No está activado en ningún móvil.'
                : 'Activado en un móvil desde el ' . esc_html(date_i18n('d/m/Y H:i', (int) $d['desde'])) . '.';
            echo '<br>Cambios de móvil en el último año: ' . $movs . ' de ' . T360L_MOVIMIENTOS_ANO . '.</p>';
            if (!empty($d['disp'])) {
                echo '<form method="post"><input type="hidden" name="codigo" value="' . esc_attr($codigo) . '">';
                wp_nonce_field('t360l_soltar');
                submit_button('Soltar del móvil', 'primary', 'soltar', false);
                echo '</form>';
            }
        }
    }
    echo '</div>';
}
