extends Node

signal checkpoint_changed(checkpoint_id: StringName)
signal wind_seal_collected(seal_id: StringName, total: int)
signal tutorial_requested(tutorial_id: StringName, text: String)
signal interaction_changed(prompt: String)
signal dialogue_requested(speaker: String, text: String)
signal save_notice(message: String, is_error: bool)
signal game_completed()
signal settings_changed(settings: Dictionary)

const SAVE_PATH := "user://save_v1.json"
const SAVE_SCHEMA_VERSION := 1
const DEFAULT_CHECKPOINT := &"village_gate"

var save_data: Dictionary = {}
var checkpoint_positions: Dictionary = {}
var current_interactable: Node
var game_started := false
var completion_announced := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_game()


func _default_save() -> Dictionary:
	return {
		"schema_version": SAVE_SCHEMA_VERSION,
		"checkpoint_id": String(DEFAULT_CHECKPOINT),
		"wind_seal_ids": [],
		"tutorial_flags": [],
		"completed": false,
		"settings": {
			"mouse_sensitivity": 0.0025,
			"invert_y": false,
			"master_volume": 0.8,
		},
	}


func load_game() -> void:
	save_data = _default_save()
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		save_notice.emit("The save file was unreadable; a fresh journey was started.", true)
		return
	if int(parsed.get("schema_version", 0)) != SAVE_SCHEMA_VERSION:
		save_notice.emit("This save belongs to an unsupported version.", true)
		return
	_merge_save(parsed)


func _merge_save(parsed: Dictionary) -> void:
	save_data["checkpoint_id"] = str(parsed.get("checkpoint_id", DEFAULT_CHECKPOINT))
	save_data["wind_seal_ids"] = parsed.get("wind_seal_ids", []).duplicate()
	save_data["tutorial_flags"] = parsed.get("tutorial_flags", []).duplicate()
	save_data["completed"] = bool(parsed.get("completed", false))
	var loaded_settings: Dictionary = parsed.get("settings", {})
	var settings: Dictionary = save_data["settings"]
	settings["mouse_sensitivity"] = clampf(float(loaded_settings.get("mouse_sensitivity", 0.0025)), 0.0008, 0.007)
	settings["invert_y"] = bool(loaded_settings.get("invert_y", false))
	settings["master_volume"] = clampf(float(loaded_settings.get("master_volume", 0.8)), 0.0, 1.0)


func save_game(show_notice := false) -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		save_notice.emit("Progress could not be saved in this browser.", true)
		return false
	file.store_string(JSON.stringify(save_data, "\t"))
	file.close()
	if FileAccess.get_open_error() != OK:
		save_notice.emit("Progress could not be saved in this browser.", true)
		return false
	if OS.has_feature("web") and not OS.is_userfs_persistent():
		save_notice.emit("Browser storage is temporary. Progress may disappear when this tab closes.", true)
		return false
	if show_notice:
		save_notice.emit("Journey saved", false)
	return true


func register_checkpoint(checkpoint_id: StringName, spawn_position: Vector3) -> void:
	checkpoint_positions[checkpoint_id] = spawn_position


func activate_checkpoint(checkpoint_id: StringName) -> void:
	if str(save_data.get("checkpoint_id", "")) == String(checkpoint_id):
		return
	save_data["checkpoint_id"] = String(checkpoint_id)
	checkpoint_changed.emit(checkpoint_id)
	save_game(true)


func respawn_player(player: Node3D) -> void:
	var checkpoint_id := StringName(save_data.get("checkpoint_id", String(DEFAULT_CHECKPOINT)))
	var fallback := checkpoint_positions.get(DEFAULT_CHECKPOINT, Vector3(0.0, 2.0, 120.0)) as Vector3
	player.global_position = checkpoint_positions.get(checkpoint_id, fallback)
	if player.has_method("reset_after_respawn"):
		player.call("reset_after_respawn")


func collect_wind_seal(seal_id: StringName) -> bool:
	var collected: Array = save_data["wind_seal_ids"]
	if String(seal_id) in collected:
		return false
	collected.append(String(seal_id))
	wind_seal_collected.emit(seal_id, collected.size())
	save_game()
	return true


func has_wind_seal(seal_id: StringName) -> bool:
	return String(seal_id) in (save_data.get("wind_seal_ids", []) as Array)


func request_tutorial(tutorial_id: StringName, text: String) -> void:
	var flags: Array = save_data["tutorial_flags"]
	if String(tutorial_id) in flags:
		return
	flags.append(String(tutorial_id))
	tutorial_requested.emit(tutorial_id, text)
	save_game()


func offer_interaction(interactable: Node) -> void:
	current_interactable = interactable
	interaction_changed.emit(interactable.get_prompt() if interactable != null and interactable.has_method("get_prompt") else "")


func clear_interaction(interactable: Node) -> void:
	if current_interactable != interactable:
		return
	current_interactable = null
	interaction_changed.emit("")


func interact() -> void:
	if is_instance_valid(current_interactable) and current_interactable.has_method("interact"):
		current_interactable.interact()


func complete_game() -> void:
	if completion_announced:
		return
	completion_announced = true
	save_data["completed"] = true
	save_game()
	game_completed.emit()


func get_setting(key: String, fallback: Variant) -> Variant:
	return (save_data.get("settings", {}) as Dictionary).get(key, fallback)


func set_setting(key: String, value: Variant) -> void:
	(save_data["settings"] as Dictionary)[key] = value
	settings_changed.emit(save_data["settings"])
	save_game()


func begin_game() -> void:
	game_started = true

