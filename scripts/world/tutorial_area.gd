class_name TutorialArea
extends Area3D

@export var tutorial_id: StringName = &"tutorial"
@export_multiline var tutorial_text := ""


func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		GameState.request_tutorial(tutorial_id, tutorial_text)

