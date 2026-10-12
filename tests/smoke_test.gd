extends Node

var failures: Array[String] = []


func _ready() -> void:
	call_deferred("_run")


func _run() -> void:
	_check_resource("res://scenes/main.tscn")
	_check_resource("res://scenes/player.tscn")
	_check_resource("res://scenes/hud.tscn")
	_check_resource("res://resources/default_movement_profile.tres")
	_check_input_actions()

	var profile := load("res://resources/default_movement_profile.tres") as MovementProfile
	_expect(profile != null, "MovementProfile loads")
	if profile:
		_expect(profile.sprint_speed > profile.walk_speed, "Sprint is faster than walk")
		_expect(profile.dash_speed > profile.sprint_speed, "Air dash is faster than sprint")
		_expect(profile.coyote_time > 0.0, "Coyote time is enabled")

	var main_scene := load("res://scenes/main.tscn") as PackedScene
	if main_scene:
		var world := main_scene.instantiate()
		get_tree().root.add_child(world)
		await get_tree().process_frame
		await get_tree().physics_frame
		var player := get_tree().get_first_node_in_group("player") as PlayerController
		var game_state := get_tree().root.get_node_or_null("GameState")
		_expect(player != null, "World creates the player")
		_expect(get_tree().get_nodes_in_group("traversable_wall").size() == 2, "World has exactly two authored wall-run surfaces")
		_expect(game_state != null, "GameState autoload is present")
		if game_state:
			var checkpoints: Dictionary = game_state.get("checkpoint_positions")
			_expect(checkpoints.has(&"village_gate"), "Village checkpoint registers")
			_expect(checkpoints.has(&"cliff_camp"), "Cliff checkpoint registers")
			_expect(checkpoints.has(&"shrine_approach"), "Shrine checkpoint registers")
		if player:
			_expect(player.movement_profile != null, "Player has a movement profile")
			_expect(player.air_dash_available, "Player begins with an air dash")
		world.queue_free()

	if failures.is_empty():
		print("SMOKE TEST PASSED")
		get_tree().quit(0)
	else:
		for failure in failures:
			push_error(failure)
		print("SMOKE TEST FAILED: %d issue(s)" % failures.size())
		get_tree().quit(1)


func _check_resource(path: String) -> void:
	_expect(ResourceLoader.exists(path), "%s exists" % path)
	_expect(load(path) != null, "%s loads" % path)


func _check_input_actions() -> void:
	for action in [
		&"move_forward", &"move_back", &"move_left", &"move_right", &"sprint",
		&"jump", &"air_dash", &"interact", &"pause", &"reset_checkpoint"
	]:
		_expect(InputMap.has_action(action), "Input action '%s' exists" % action)


func _expect(condition: bool, message: String) -> void:
	if condition:
		print("PASS: %s" % message)
	else:
		failures.append("FAIL: %s" % message)

