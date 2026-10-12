class_name WandererNpc
extends Area3D

@export var speaker_name := "Old Wanderer"
@export_multiline var dialogue := "The mountain path is longer than it looks. Let the wind carry what your feet cannot."
var _spoken := false


func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func get_prompt() -> String:
	return "E  Speak with %s" % speaker_name


func interact() -> void:
	_spoken = true
	GameState.dialogue_requested.emit(speaker_name, dialogue)
	GameState.request_tutorial(&"journey_goal", "Follow the pale banners north to the mountain shrine")


func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		GameState.offer_interaction(self)


func _on_body_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		GameState.clear_interaction(self)

