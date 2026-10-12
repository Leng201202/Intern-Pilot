class_name JourneyCheckpoint
extends Area3D

@export var checkpoint_id: StringName = &"checkpoint"
@export var spawn_offset := Vector3(0.0, 1.0, 0.0)
var _activated := false


func _ready() -> void:
	collision_layer = 4
	collision_mask = 2
	monitoring = true
	GameState.register_checkpoint(checkpoint_id, global_position + spawn_offset)
	body_entered.connect(_on_body_entered)
	_activated = str(GameState.save_data.get("checkpoint_id", "")) == String(checkpoint_id)
	_update_visual()


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if not _activated:
		_activated = true
		GameState.activate_checkpoint(checkpoint_id)
		AudioDirector.play_sfx(&"checkpoint")
	_update_visual()


func _update_visual() -> void:
	var marker := get_node_or_null("Marker") as MeshInstance3D
	if marker == null:
		return
	var material := marker.material_override as StandardMaterial3D
	if material:
		material.albedo_color = Color("9cebd9") if _activated else Color("d7a95b")
		material.emission_enabled = _activated
		material.emission = Color("4cccb3")
		material.emission_energy_multiplier = 1.6

