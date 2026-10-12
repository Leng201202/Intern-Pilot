class_name PlayerController
extends CharacterBody3D

signal movement_state_changed(previous_state: MovementState, new_state: MovementState)
signal checkpoint_requested(checkpoint_id: StringName)

enum MovementState {
	GROUNDED,
	SPRINTING,
	JUMPING,
	FALLING,
	AIR_DASHING,
	WALL_RUNNING,
	MANTLING,
	LANDING,
}

@export var movement_profile: MovementProfile

@onready var camera_yaw: Node3D = $CameraYaw
@onready var camera_pitch: Node3D = $CameraYaw/CameraPitch
@onready var visual_root: Node3D = $VisualRoot
@onready var dash_ribbons: GPUParticles3D = $DashRibbons

var movement_state := MovementState.GROUNDED
var air_dash_available := true
var _dash_direction := Vector3.ZERO
var _dash_time_left := 0.0
var _dash_cooldown_left := 0.0
var _wall_run_time_left := 0.0
var _wall_normal := Vector3.ZERO
var _mantle_target := Vector3.ZERO
var _jump_buffer_left := 0.0
var _coyote_left := 0.0
var _landing_time_left := 0.0
var _camera_pitch_value := deg_to_rad(-10.0)
var _last_safe_position := Vector3.ZERO
var _safe_position_timer := 0.0


func _ready() -> void:
	if movement_profile == null:
		movement_profile = load("res://resources/default_movement_profile.tres") as MovementProfile
	camera_pitch.rotation.x = _camera_pitch_value
	GameState.settings_changed.connect(_on_settings_changed)
	_last_safe_position = global_position
	dash_ribbons.emitting = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and GameState.game_started:
		var sensitivity := float(GameState.get_setting("mouse_sensitivity", movement_profile.mouse_sensitivity))
		var invert := -1.0 if bool(GameState.get_setting("invert_y", false)) else 1.0
		camera_yaw.rotation.y -= event.relative.x * sensitivity
		_camera_pitch_value -= event.relative.y * sensitivity * invert
		_camera_pitch_value = clampf(
			_camera_pitch_value,
			deg_to_rad(movement_profile.camera_min_pitch_degrees),
			deg_to_rad(movement_profile.camera_max_pitch_degrees)
		)
		camera_pitch.rotation.x = _camera_pitch_value
	if event.is_action_pressed("interact") and GameState.game_started:
		GameState.interact()
	if event.is_action_pressed("reset_checkpoint") and GameState.game_started:
		GameState.respawn_player(self)
		get_viewport().set_input_as_handled()


func _physics_process(delta: float) -> void:
	if not GameState.game_started:
		velocity = Vector3.ZERO
		return
	_dash_cooldown_left = maxf(0.0, _dash_cooldown_left - delta)
	_jump_buffer_left = maxf(0.0, _jump_buffer_left - delta)
	if Input.is_action_just_pressed("jump"):
		_jump_buffer_left = movement_profile.jump_buffer_time

	var was_on_floor := is_on_floor()
	if was_on_floor:
		_coyote_left = movement_profile.coyote_time
		air_dash_available = true
	else:
		_coyote_left = maxf(0.0, _coyote_left - delta)

	var input_2d := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := _camera_relative_direction(input_2d)

	match movement_state:
		MovementState.AIR_DASHING:
			_update_air_dash(delta)
		MovementState.WALL_RUNNING:
			_update_wall_run(delta, direction)
		MovementState.MANTLING:
			_update_mantle(delta)
		_:
			_update_standard_movement(delta, direction, input_2d.length())

	move_and_slide()
	_update_post_move(delta, was_on_floor, direction)


func _update_standard_movement(delta: float, direction: Vector3, input_strength: float) -> void:
	var grounded := is_on_floor() or _coyote_left > 0.0
	var sprinting := grounded and Input.is_action_pressed("sprint") and input_strength > 0.1
	var target_speed := movement_profile.sprint_speed if sprinting else movement_profile.walk_speed
	var acceleration := movement_profile.ground_acceleration if grounded else movement_profile.air_acceleration
	var target_horizontal := direction * target_speed
	velocity.x = move_toward(velocity.x, target_horizontal.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target_horizontal.z, acceleration * delta)

	if not is_on_floor():
		velocity.y -= movement_profile.gravity * delta
	else:
		velocity.y = -0.5

	if _jump_buffer_left > 0.0 and grounded:
		_jump_buffer_left = 0.0
		_coyote_left = 0.0
		velocity.y = movement_profile.jump_velocity
		_set_movement_state(MovementState.JUMPING)
		AudioDirector.play_sfx(&"jump")
	elif Input.is_action_just_pressed("air_dash") and not is_on_floor() and air_dash_available and _dash_cooldown_left <= 0.0:
		_start_air_dash(direction)
	elif not is_on_floor() and _jump_buffer_left > 0.0 and _try_start_mantle(direction):
		_jump_buffer_left = 0.0
	elif not is_on_floor() and direction.length_squared() > 0.1 and _try_start_wall_run(direction):
		pass
	elif grounded:
		_set_movement_state(MovementState.SPRINTING if sprinting else MovementState.GROUNDED)
	elif velocity.y > 0.0:
		_set_movement_state(MovementState.JUMPING)
	else:
		_set_movement_state(MovementState.FALLING)

	_face_direction(direction, delta)


func _start_air_dash(direction: Vector3) -> void:
	air_dash_available = false
	_dash_time_left = movement_profile.dash_duration
	_dash_cooldown_left = movement_profile.dash_cooldown
	_dash_direction = direction
	if _dash_direction.length_squared() < 0.1:
		_dash_direction = -camera_yaw.global_basis.z
		_dash_direction.y = 0.0
		_dash_direction = _dash_direction.normalized()
	_set_movement_state(MovementState.AIR_DASHING)
	dash_ribbons.emitting = true
	AudioDirector.play_sfx(&"dash")


func _update_air_dash(delta: float) -> void:
	_dash_time_left -= delta
	velocity = _dash_direction * movement_profile.dash_speed
	velocity.y = 0.35
	_face_direction(_dash_direction, delta)
	if _dash_time_left <= 0.0:
		dash_ribbons.emitting = false
		_set_movement_state(MovementState.FALLING)


func _try_start_wall_run(direction: Vector3) -> bool:
	if velocity.y < -5.0:
		return false
	var result := _find_traversable_wall()
	if result.is_empty():
		return false
	_wall_normal = result.normal
	var along_wall := direction.slide(_wall_normal)
	if along_wall.length_squared() < 0.25:
		return false
	_wall_run_time_left = movement_profile.wall_run_duration
	_set_movement_state(MovementState.WALL_RUNNING)
	GameState.request_tutorial(&"wall_jump", "Press SPACE while wall-running to leap away")
	return true


func _update_wall_run(delta: float, direction: Vector3) -> void:
	_wall_run_time_left -= delta
	var wall := _find_traversable_wall()
	if wall.is_empty() or _wall_run_time_left <= 0.0 or direction.length_squared() < 0.05:
		_set_movement_state(MovementState.FALLING)
		return
	_wall_normal = wall.normal
	var along_wall := direction.slide(_wall_normal).normalized()
	velocity = along_wall * movement_profile.wall_run_speed
	velocity.y = movement_profile.wall_run_vertical_speed
	_face_direction(along_wall, delta)
	if Input.is_action_just_pressed("jump"):
		velocity = along_wall * movement_profile.wall_run_speed * 0.7
		velocity += _wall_normal * movement_profile.wall_jump_push
		velocity.y = movement_profile.jump_velocity * 0.9
		_jump_buffer_left = 0.0
		_set_movement_state(MovementState.JUMPING)
		AudioDirector.play_sfx(&"jump")


func _find_traversable_wall() -> Dictionary:
	var space := get_world_3d().direct_space_state
	var origin := global_position + Vector3.UP * 1.0
	var camera_right := camera_yaw.global_basis.x.normalized()
	for side in [-1.0, 1.0]:
		var query := PhysicsRayQueryParameters3D.create(origin, origin + camera_right * side * 1.05, 1, [get_rid()])
		var result := space.intersect_ray(query)
		if not result.is_empty():
			var collider: Object = result.collider
			if collider is Node and (collider as Node).is_in_group("traversable_wall"):
				return result
	return {}


func _try_start_mantle(direction: Vector3) -> bool:
	if direction.length_squared() < 0.1:
		return false
	var forward := direction.normalized()
	var space := get_world_3d().direct_space_state
	var chest_origin := global_position + Vector3.UP * 0.75
	var chest_query := PhysicsRayQueryParameters3D.create(chest_origin, chest_origin + forward * 0.85, 1, [get_rid()])
	var chest_hit := space.intersect_ray(chest_query)
	if chest_hit.is_empty():
		return false
	var head_origin := global_position + Vector3.UP * movement_profile.mantle_height
	var head_query := PhysicsRayQueryParameters3D.create(head_origin, head_origin + forward * 0.95, 1, [get_rid()])
	if not space.intersect_ray(head_query).is_empty():
		return false
	_mantle_target = global_position + forward * 0.95 + Vector3.UP * movement_profile.mantle_height
	velocity = Vector3.ZERO
	_set_movement_state(MovementState.MANTLING)
	return true


func _update_mantle(delta: float) -> void:
	global_position = global_position.move_toward(_mantle_target, movement_profile.mantle_speed * delta)
	velocity = Vector3.ZERO
	if global_position.distance_to(_mantle_target) < 0.06:
		_set_movement_state(MovementState.FALLING)


func _update_post_move(delta: float, was_on_floor: bool, direction: Vector3) -> void:
	if is_on_floor() and not was_on_floor and movement_state not in [MovementState.GROUNDED, MovementState.SPRINTING]:
		_landing_time_left = 0.14
		_set_movement_state(MovementState.LANDING)
		AudioDirector.play_sfx(&"land")
	if movement_state == MovementState.LANDING:
		_landing_time_left -= delta
		if _landing_time_left <= 0.0:
			_set_movement_state(MovementState.GROUNDED)
	if is_on_floor():
		_safe_position_timer += delta
		if _safe_position_timer >= 0.5:
			_last_safe_position = global_position
			_safe_position_timer = 0.0
	if global_position.y < -18.0:
		GameState.respawn_player(self)
	if direction.length_squared() > 0.1 and movement_state not in [MovementState.AIR_DASHING, MovementState.WALL_RUNNING]:
		_face_direction(direction, delta)


func _camera_relative_direction(input_2d: Vector2) -> Vector3:
	var forward := -camera_yaw.global_basis.z
	var right := camera_yaw.global_basis.x
	forward.y = 0.0
	right.y = 0.0
	return (right.normalized() * input_2d.x + forward.normalized() * -input_2d.y).normalized()


func _face_direction(direction: Vector3, delta: float) -> void:
	if direction.length_squared() < 0.01:
		return
	var desired_yaw := atan2(direction.x, direction.z)
	visual_root.rotation.y = lerp_angle(visual_root.rotation.y, desired_yaw, movement_profile.rotation_speed * delta)


func _set_movement_state(next_state: MovementState) -> void:
	if movement_state == next_state:
		return
	var previous := movement_state
	movement_state = next_state
	movement_state_changed.emit(previous, next_state)


func reset_after_respawn() -> void:
	velocity = Vector3.ZERO
	air_dash_available = true
	_dash_time_left = 0.0
	_wall_run_time_left = 0.0
	dash_ribbons.emitting = false
	_set_movement_state(MovementState.GROUNDED)


func get_state_name() -> String:
	return MovementState.keys()[movement_state].capitalize()


func _on_settings_changed(_settings: Dictionary) -> void:
	pass

