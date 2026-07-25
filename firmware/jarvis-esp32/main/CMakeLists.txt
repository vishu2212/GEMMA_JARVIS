idf_component_register(SRCS "app_main.c"
                       INCLUDE_DIRS "."
                       REQUIRES api assistant button display led microphone network speaker storage esp_ringbuf esp_websocket_client json nvs_flash esp_wifi esp_event driver)
