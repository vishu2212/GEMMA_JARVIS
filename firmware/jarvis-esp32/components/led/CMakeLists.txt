idf_component_register(SRCS "led.c"
                       INCLUDE_DIRS "."
                       PRIV_REQUIRES driver led_strip app_state)
