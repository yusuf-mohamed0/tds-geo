<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
/**
 * Thin connector bootstrap — initializes only what's needed for REST CRUD.
 *
 * @package TdsGeo_WP
 */

namespace TdsGeo_WP;

defined('ABSPATH') || exit;

class Main {

    private static ?self $instance = null;
    private array $services = [];

    public static function get_instance(): self {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function init(): void {
        $this->init_services();
    }

    private function init_services(): void {
        Database::init();
        Logger::init();
        RateLimiter::init();
        Cache::init();
        Auth::init();
        Api::init();
        Sync::init();
        Admin::init();
        AdminRemote::init();

        $this->services = [
            'database'    => Database::class,
            'logger'      => Logger::class,
            'ratelimiter' => RateLimiter::class,
            'cache'       => Cache::class,
            'auth'        => Auth::class,
            'api'         => Api::class,
            'sync'        => Sync::class,
            'admin'       => Admin::class,
        ];
    }

    public function get_service(string $name): ?string {
        return $this->services[$name] ?? null;
    }

    public function get_services(): array {
        return array_keys($this->services);
    }
}
