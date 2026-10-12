class_name WindSeal
extends Area3D

@export var seal_id: StringName = &"wind_seal"
@export var display_name := "Wind Seal"
var _base_y := 0.0
var _time := 0.0


func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	monitoring = true
	_base_y = position.y
	body_entered.connect(_on_body_entered)
	if GameState.has_wind_seal(seal_id):
		queue_free()


func _process(delta: float) -> void:
	_time += delta
	rotation.y += delta * 1.35
	position.y = _base_y + sin(_time * 2.2) * 0.18


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if GameState.collect_wind_seal(seal_id):
		AudioDirector.play_sfx(&"seal")
		GameState.dialogue_requested.emit("Wind Seal", "%s answers your breath. The valley remembers." % display_name)
		queue_free()

