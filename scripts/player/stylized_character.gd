extends Node3D

@onready var player: PlayerController = get_parent()
@onready var torso: MeshInstance3D = $Torso
@onready var left_arm: MeshInstance3D = $LeftArm
@onready var right_arm: MeshInstance3D = $RightArm
@onready var left_leg: MeshInstance3D = $LeftLeg
@onready var right_leg: MeshInstance3D = $RightLeg
@onready var scarf: MeshInstance3D = $Scarf

var _time := 0.0
var _state := PlayerController.MovementState.GROUNDED


func _ready() -> void:
	player.movement_state_changed.connect(_on_state_changed)


func _process(delta: float) -> void:
	_time += delta
	var horizontal_speed := Vector2(player.velocity.x, player.velocity.z).length()
	var stride_speed := clampf(horizontal_speed * 1.2, 3.0, 13.0)
	var stride_amount := clampf(horizontal_speed / 10.0, 0.0, 1.0)
	if _state in [PlayerController.MovementState.GROUNDED, PlayerController.MovementState.SPRINTING, PlayerController.MovementState.LANDING]:
		var swing := sin(_time * stride_speed) * 0.65 * stride_amount
		left_arm.rotation.x = lerpf(left_arm.rotation.x, swing, delta * 12.0)
		right_arm.rotation.x = lerpf(right_arm.rotation.x, -swing, delta * 12.0)
		left_leg.rotation.x = lerpf(left_leg.rotation.x, -swing, delta * 12.0)
		right_leg.rotation.x = lerpf(right_leg.rotation.x, swing, delta * 12.0)
		torso.position.y = 1.35 + absf(sin(_time * stride_speed)) * 0.035 * stride_amount
	elif _state == PlayerController.MovementState.AIR_DASHING:
		left_arm.rotation.x = lerpf(left_arm.rotation.x, -1.2, delta * 10.0)
		right_arm.rotation.x = lerpf(right_arm.rotation.x, -1.0, delta * 10.0)
		left_leg.rotation.x = lerpf(left_leg.rotation.x, 0.7, delta * 10.0)
		right_leg.rotation.x = lerpf(right_leg.rotation.x, -0.4, delta * 10.0)
	elif _state == PlayerController.MovementState.WALL_RUNNING:
		left_arm.rotation.x = lerpf(left_arm.rotation.x, 1.1, delta * 8.0)
		right_arm.rotation.x = lerpf(right_arm.rotation.x, -0.5, delta * 8.0)
	else:
		left_arm.rotation.x = lerpf(left_arm.rotation.x, 0.3, delta * 7.0)
		right_arm.rotation.x = lerpf(right_arm.rotation.x, -0.3, delta * 7.0)
		left_leg.rotation.x = lerpf(left_leg.rotation.x, -0.2, delta * 7.0)
		right_leg.rotation.x = lerpf(right_leg.rotation.x, 0.2, delta * 7.0)
	var scarf_target := clampf(horizontal_speed * 0.045, 0.1, 0.65)
	scarf.rotation.x = lerpf(scarf.rotation.x, scarf_target + sin(_time * 5.0) * 0.08, delta * 5.0)


func _on_state_changed(_previous: PlayerController.MovementState, next: PlayerController.MovementState) -> void:
	_state = next

