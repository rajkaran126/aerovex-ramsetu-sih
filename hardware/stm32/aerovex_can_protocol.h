/**
 * ============================================================================
 * AEROVEX / AERO-TWIN — STM32 SENSOR NODE CAN PROTOCOL SPECIFICATION
 * ============================================================================
 * Target MCU : STM32F405 / STM32F446 / STM32H743
 * Transceiver: MCP2515 (SPI) or SN65HVD230 (On-chip bxCAN)
 * CAN Speed  : 500 kbps / 1 Mbps, Standard 11-bit Arbitration IDs
 * ============================================================================
 */

#ifndef AEROVEX_CAN_PROTOCOL_H
#define AEROVEX_CAN_PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ── CAN Arbitration IDs ─────────────────────────────────────────────────── */
#define CAN_ID_CORE_DYNAMICS     0x100U /* Period: 20ms (50 Hz) */
#define CAN_ID_THERMAL_STATE     0x101U /* Period: 100ms (10 Hz) */
#define CAN_ID_FLUID_DYNAMICS    0x102U /* Period: 50ms (20 Hz) */
#define CAN_ID_VIB_AND_LOAD      0x103U /* Period: 20ms (50 Hz) */
#define CAN_ID_ENVIRONMENTAL     0x104U /* Period: 200ms (5 Hz) */
#define CAN_ID_NODE_HEALTH       0x105U /* Period: 500ms (2 Hz) */

/* ── CAN ID 0x100: Core Engine Dynamics (5 Bytes) ────────────────────────── */
#pragma pack(push, 1)
typedef struct {
    uint16_t rpm;            /* Scale: 1 RPM/bit, Range: 0..7500 RPM, Big-Endian */
    uint8_t  throttle_raw;   /* Scale: 100/255 % (0..1.0 normalized) */
    uint16_t map_cInHg;      /* Scale: 0.01 inHg/bit (100 = 1.0 inHg), Range: 0..6000 */
} can_msg_core_dynamics_t;

/* ── CAN ID 0x101: Thermal State (4 Bytes) ────────────────────────────────── */
typedef struct {
    uint16_t cht_celsius_x10;/* Scale: 0.1 deg C/bit, Range: 0..3500 (0..350.0 C) */
    uint16_t egt_celsius_x10;/* Scale: 0.1 deg C/bit, Range: 0..12000 (0..1200.0 C) */
} can_msg_thermal_state_t;

/* ── CAN ID 0x102: Fluid Pressures & Flow (6 Bytes) ───────────────────────── */
typedef struct {
    uint16_t oil_pressure_cbar; /* Scale: 0.01 bar/bit, Range: 0..1200 (0..12.0 bar) */
    uint16_t oil_temp_x10;      /* Scale: 0.1 deg C/bit, Range: 0..1800 (0..180.0 C) */
    uint16_t fuel_flow_cLph;    /* Scale: 0.01 L/h/bit, Range: 0..8000 (0..80.0 L/h) */
} can_msg_fluid_dynamics_t;

/* ── CAN ID 0x103: Vibration & Load (3 Bytes) ────────────────────────────── */
typedef struct {
    uint16_t vibration_cg;      /* Scale: 0.01 g-RMS/bit, Range: 0..3000 (0..30.0 g) */
    uint8_t  engine_load_raw;   /* Scale: 100/255 % */
} can_msg_vib_and_load_t;

/* ── CAN ID 0x104: Environmental Metrics (6 Bytes) ────────────────────────── */
typedef struct {
    int16_t  ambient_temp_x10;  /* Scale: 0.1 deg C/bit, Signed, Range: -500..800 */
    uint16_t ambient_pres_chPa; /* Scale: 0.1 hPa/bit, Range: 2000..12000 */
    int16_t  altitude_daft;     /* Scale: 10 ft/bit (daft), Signed */
} can_msg_environmental_t;

/* ── CAN ID 0x105: Node Health & Watchdog (4 Bytes) ───────────────────────── */
typedef struct {
    uint8_t  v_batt_cVolts;     /* Scale: 0.1 V/bit (120 = 12.0V) */
    uint16_t packet_seq_num;    /* Rolling counter [0..65535] */
    uint8_t  error_flags;       /* Bit 0: ADC fail, Bit 1: TC fail, Bit 2: Sensor OOR */
} can_msg_node_health_t;
#pragma pack(pop)

/* ── STM32 Hardware Pin Mapping Reference ────────────────────────────────── */
#define PIN_RPM_PULSE_TIM2_CH1  /* PA0 (TIM2 Input Capture, 60-2 or 1 pulse/rev) */
#define PIN_MAP_ADC1_IN1        /* PA1 (0-5V MPX4250AP via 2:3 voltage divider) */
#define PIN_OIL_P_ADC1_IN2      /* PA2 (0-5V 0-10 bar transducer via divider) */
#define PIN_THROTTLE_ADC1_IN3   /* PA3 (TPS Potentiometer 0-3.3V) */
#define PIN_SPI1_MAX31855_CS1   /* PB0 (CHT Type-K Thermocouple SPI) */
#define PIN_SPI1_MAX31855_CS2   /* PB1 (EGT Type-K Thermocouple SPI) */
#define PIN_ADXL345_I2C1_SCL    /* PB6 (I2C Accelerometer Vibration 400kHz) */
#define PIN_ADXL345_I2C1_SDA    /* PB7 */
#define PIN_CAN1_TX             /* PB9 (SN65HVD230 Transceiver TX) */
#define PIN_CAN1_RX             /* PB8 (SN65HVD230 Transceiver RX) */

#ifdef __cplusplus
}
#endif

#endif /* AEROVEX_CAN_PROTOCOL_H */
