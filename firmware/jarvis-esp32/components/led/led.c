#include "led.h"
#include "driver/gpio.h"
#include "led_strip.h"
#include "esp_log.h"

static const char *TAG = "LED";

/* ── Plain GPIO LED (backward-compat) ─────────────────────── */
void led_init(status_led_t *led, gpio_num_t pin) {
    if (!led) return;
    led->pin   = pin;
    led->state = false;

    gpio_config_t io_conf = {};
    io_conf.intr_type    = GPIO_INTR_DISABLE;
    io_conf.mode         = GPIO_MODE_OUTPUT;
    io_conf.pin_bit_mask = (1ULL << led->pin);
    io_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    io_conf.pull_up_en   = GPIO_PULLUP_DISABLE;
    gpio_config(&io_conf);
    gpio_set_level(led->pin, 0);
}

void led_set(status_led_t *led, bool on) {
    if (!led) return;
    led->state = on;
    gpio_set_level(led->pin, on ? 1 : 0);
}

void led_toggle(status_led_t *led) {
    if (!led) return;
    led_set(led, !led->state);
}

/* ── WS2812 NeoPixel (RMT) ─────────────────────────────────── */
static led_strip_handle_t s_strip = NULL;

void led_rgb_init(gpio_num_t gpio) {
    led_strip_config_t strip_cfg = {
        .strip_gpio_num   = gpio,
        .max_leds         = 1,
        .led_model        = LED_MODEL_WS2812,
        .color_component_format = LED_STRIP_COLOR_COMPONENT_FMT_GRB,
        .flags = {
            .invert_out = false,
        },
    };

    led_strip_rmt_config_t rmt_cfg = {
        .clk_src       = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000,  /* 10 MHz */
        .flags = {
            .with_dma = false,
        },
    };

    esp_err_t ret = led_strip_new_rmt_device(&strip_cfg, &rmt_cfg, &s_strip);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "led_strip_new_rmt_device failed: %s", esp_err_to_name(ret));
        s_strip = NULL;
        return;
    }

    /* Start dark */
    led_strip_clear(s_strip);
    led_strip_refresh(s_strip);
    ESP_LOGI(TAG, "RGB NeoPixel init OK (GPIO %d)", gpio);
}

void led_set_rgb(uint8_t r, uint8_t g, uint8_t b) {
    if (!s_strip) return;
    /* Scale by LED_BRIGHTNESS so the raw value stays perceptually dim */
    uint8_t scale = LED_BRIGHTNESS;
    led_strip_set_pixel(s_strip, 0,
        (uint32_t)r * scale / 255,
        (uint32_t)g * scale / 255,
        (uint32_t)b * scale / 255);
    led_strip_refresh(s_strip);
}

void led_off(void) {
    if (!s_strip) return;
    led_strip_clear(s_strip);
    led_strip_refresh(s_strip);
}

/* ── State → Colour Mapping ─────────────────────────────────
   Colour    State            Meaning
   ──────────────────────────────────────────────────────────
   White dim LED_STATE_BOOT             Starting up
   Amber     LED_STATE_WIFI_CONNECTING  Waiting for network
   Green     LED_STATE_IDLE             Ready — say "Hey JARVIS"
   Blue      LED_STATE_LISTENING        Microphone active
   Yellow    LED_STATE_PROCESSING       Gemma 4 is thinking
   Purple    LED_STATE_SPEAKING         Piper TTS playing
   Red       LED_STATE_ERROR            Something went wrong
   ────────────────────────────────────────────────────────── */
void led_set_state(led_state_t state) {
    switch (state) {
        case LED_STATE_BOOT:
            led_set_rgb(255, 255, 255);   /* White — booting         */
            break;
        case LED_STATE_WIFI_CONNECTING:
            led_set_rgb(255, 140,   0);   /* Amber — connecting WiFi */
            break;
        case LED_STATE_IDLE:
            led_set_rgb(  0, 255,   0);   /* Green — ready           */
            break;
        case LED_STATE_LISTENING:
            led_set_rgb(  0, 80,  255);   /* Blue  — listening       */
            break;
        case LED_STATE_PROCESSING:
            led_set_rgb(255, 220,   0);   /* Yellow — thinking       */
            break;
        case LED_STATE_SPEAKING:
            led_set_rgb(160,  32, 240);   /* Purple — speaking       */
            break;
        case LED_STATE_ERROR:
            led_set_rgb(255,   0,   0);   /* Red — error             */
            break;
        default:
            led_off();
            break;
    }
}
