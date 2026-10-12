class_name ShrineGoal
extends Area3D

var _player_inside := false


func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func get_prompt() -> String:
	return "E  Awaken the mountain shrine"


func interact() -> void:
	if _player_inside:
		GameState.complete_game()


func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_player_inside = true
		GameState.offer_interaction(self)


func _on_body_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		_player_inside = false
		GameState.clear_interaction(self)

