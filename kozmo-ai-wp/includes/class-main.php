<?php
/**
 * Main plugin controller.
 *
 * @package KozmoAI_WP
 */

namespace KozmoAI_WP;

defined('ABSPATH') || exit;

/**
 * Core plugin class — initializes all services.
 */
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
        $this->load_dependencies();
        $this->init_services();
        $this->init_hooks();
    }

    private function load_dependencies(): void {
        // All autoloaded via spl_autoload_register
    }

    private function init_services(): void {
        // Core infrastructure — order matters
        Database::init();
        Logger::init();
        Security::init();
        Cache::init();
        RateLimiter::init();
        HealEngine::init();

        // Auth & API layer
        Auth::init();

        // Scanner builds the knowledge base on activation & cron
        Scanner::init();
        KnowledgeBase::init();

        // Content & SEO intelligence
        ContentAnalyzer::init();
        SeoAuditor::init();
        QualityScorer::init();

        // Workflow engine
        Scheduler::init();
        Worker::init();

        // REST API
        Api::init();

        // Admin UI
        Admin::init();
        Dashboard::init();

        // Health & maintenance
        Health::init();
        Diagnostics::init();
        Update::init();

        // Telemetry (daily health ping)
        Telemetry::init();

        // Sync & pipeline
        Sync::init();

        // Backend API bridge (when backend/ is deployed)
        BackendClient::init();

        // Graphify knowledge graph client
        GraphifyClient::init();

        // AI Content Generator (self-contained, no backend needed)
        ContentGenerator::init();

        $this->services = [
            'database'         => Database::class,
            'logger'           => Logger::class,
            'security'         => Security::class,
            'cache'            => Cache::class,
            'ratelimiter'      => RateLimiter::class,
            'auth'             => Auth::class,
            'scanner'          => Scanner::class,
            'knowledge'        => KnowledgeBase::class,
            'analyzer'         => ContentAnalyzer::class,
            'seo'              => SeoAuditor::class,
            'quality'          => QualityScorer::class,
            'scheduler'        => Scheduler::class,
            'worker'           => Worker::class,
            'contentgenerator' => ContentGenerator::class,
            'api'              => Api::class,
            'admin'            => Admin::class,
            'dashboard'        => Dashboard::class,
            'health'           => Health::class,
            'diagnostics'      => Diagnostics::class,
            'update'           => Update::class,
            'sync'             => Sync::class,
            'heal'             => HealEngine::class,
            'telemetry'        => Telemetry::class,
            'backend'          => BackendClient::class,
            'graphify'         => GraphifyClient::class,
        ];

        Logger::info('KOZMO AI WP Agent initialized', [
            'version'    => KOZMO_AI_WP_VERSION,
            'services'   => array_keys($this->services),
            'agent_url'  => KOZMO_AI_WP_AGENT_URL,
        ]);
    }

    private function init_hooks(): void {
        add_action('init', [$this, 'on_wp_init']);
        add_action('init', [self::class, 'try_process']);
        add_action('wp', [$this, 'on_frontend']);
        add_action('rest_api_init', [$this, 'on_rest_init']);
        // Cron schedules are registered globally in kozmo-ai-wp.php (needed early for activation)
    }

    /**
     * Fallback processor: runs queue processing and auto-generation on any page load.
     * Transient-guarded to run at most once per 60s as a safety net when WP-Cron drops events.
     */
    public static function try_process(): void {
        if (wp_doing_ajax() || wp_doing_cron()) return;
        if (get_transient('kozmo_ai_try_process_lock')) return;
        set_transient('kozmo_ai_try_process_lock', time(), 60);

        Worker::process_queue();
        Worker::maybe_auto_generate();
    }

    public function on_wp_init(): void {
        if (is_admin()) {
            Dashboard::load_activity_feed();
        }
    }

    public function on_frontend(): void {
        // Frontend hooks — inject inline schema, analytics, etc.
    }

    public function on_rest_init(): void {
        // REST API already registered by Api::init()
    }

    /**
     * Get a registered service by name.
     */
    public function get_service(string $name): ?string {
        return $this->services[$name] ?? null;
    }

    /**
     * Get all registered service names.
     */
    public function get_services(): array {
        return array_keys($this->services);
    }
}
