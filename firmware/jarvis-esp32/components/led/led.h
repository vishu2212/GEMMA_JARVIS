#pragma once

#include "driver/gpio.h"
#include "led_strip.h"
#include "app_state.h"
#include <stdbool.h>

/* ── Colour presets (R, G, B) ─────────────────────────────────
   State          Colour
   BOOT           White dim   (boot splash)
   WIFI_CONNECT   Amber pulse (waiting for network)
   IDLE / READY   Green       (ready to talk)
   LISTENING      Blue        (hearing you)
   PROCESSING     Yellow      (Gemma thinking)
   SPEAKING       Purple      (Piper speaking)
   ERROR          Red         (something went wrong)
   ──────────────────────────────────────────────────────────── */

#define LED_BRIGHTNESS   12   /* 0–255 — keep low so it's not blinding */

/* Plain GPIO LED (kept for backward-compat if needed) */
typedef struct {
    gpio_num_t pin;
    bool state;
} status_led_t;

void led_init(status_led_t *led, gpio_num_t pin);
void led_set(status_led_t *led, bool on);
void led_toggle(status_led_t *led);

/* ── NeoPixel / WS2812 RGB LED ───────────────────────────────── */

/**
 * @brief  Initialise the WS2812 NeoPixel on the given GPIO via RMT.
 *         Must be called once at startup before any led_set_* call.
 * @param  gpio  GPIO number of the data line (GPIO_NUM_48 on ESP32-S3-DevKit-N8R2)
 */
void led_rgb_init(gpio_num_t gpio);

/**
 * @brief  Set an arbitrary RGB colour.
 * @param  r  Red   0–255
 * @param  g  Green 0–255
 * @param  b  Blue  0–255
 */
void led_set_rgb(uint8_t r, uint8_t g, uint8_t b);

/**
 * @brief  Set LED colour to match an app_state_t.
 *         Maps states → canonical JARVIS status colours.
 */
void led_set_state(app_state_t state);

/**
 * @brief  Turn the NeoPixel off.
 */
void led_off(void);
