class_name MovementProfile
extends Resource

@export_category("Ground movement")
@export var walk_speed: float = 6.0
@export var sprint_speed: float = 10.5
@export var ground_acceleration: float = 34.0
@export var air_acceleration: float = 12.0
@export var rotation_speed: float = 12.0

@export_category("Jumping")
@export var jump_velocity: float = 9.5
@export var gravity: float = 24.0
@export var coyote_time: float = 0.14
@export var jump_buffer_time: float = 0.14

@export_category("Qinggong")
@export var dash_speed: float = 21.0
@export var dash_duration: float = 0.22
@export var dash_cooldown: float = 0.15
@export var wall_run_speed: float = 9.5
@export var wall_run_duration: float = 1.15
@export var wall_run_vertical_speed: float = 1.1
@export var wall_jump_push: float = 6.5
@export var mantle_speed: float = 6.0
@export var mantle_height: float = 1.5

@export_category("Camera")
@export var mouse_sensitivity: float = 0.0025
@export var camera_min_pitch_degrees: float = -55.0
@export var camera_max_pitch_degrees: float = 62.0

