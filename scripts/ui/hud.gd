extends CanvasLayer

@onready var objective_label: Label = %ObjectiveLabel
@onready var checkpoint_label: Label = %CheckpointLabel
@onready var seal_label: Label = %SealLabel
@onready var state_label: Label = %StateLabel
@onready var tutorial_panel: Control = %TutorialPanel
@onready var tutorial_label: Label = %TutorialLabel
@onready var tutorial_timer: Timer = %TutorialTimer
@onready var interaction_label: Label = %InteractionLabel
@onready var dialogue_panel: Control = %DialoguePanel
@onready var speaker_label: Label = %SpeakerLabel
@onready var dialogue_label: Label = %DialogueLabel
@onready var dialogue_timer: Timer = %DialogueTimer
@onready var toast_panel: Control = %ToastPanel
@onready var toast_label: Label = %ToastLabel
@onready var toast_timer: Timer = %ToastTimer
@onready var opening_overlay: Control = %OpeningOverlay
@onready var pause_overlay: Control = %PauseOverlay
@onready var ending_overlay: Control = %EndingOverlay
@onready var ending_seals_label: Label = %EndingSealsLabel
@onready var sensitivity_slider: HSlider = %SensitivitySlider
@onready var invert_y_check: CheckButton = %InvertYCheck
@onready var volume_slider: HSlider = %VolumeSlider

var _player: PlayerController


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_player = get_tree().get_first_node_in_group("player") as PlayerController
	if _player:
		_player.movement_state_changed.connect(_on_player_state_changed)
	GameState.checkpoint_changed.connect(_on_checkpoint_changed)
	GameState.wind_seal_collected.connect(_on_wind_seal_collected)
	GameState.tutorial_requested.connect(_on_tutorial_requested)
	GameState.interaction_changed.connect(_on_interaction_changed)
	GameState.dialogue_requested.connect(_on_dialogue_requested)
	GameState.save_notice.connect(_on_save_notice)
	GameState.game_completed.connect(_on_game_completed)
	tutorial_timer.timeout.connect(func() -> void: tutorial_panel.hide())
	dialogue_timer.timeout.connect(func() -> void: dialogue_panel.hide())
	toast_timer.timeout.connect(func() -> void: toast_panel.hide())
	%BeginButton.pressed.connect(_begin_journey)
	%ResumeButton.pressed.connect(_resume_game)
	%RestartButton.pressed.connect(_restart_checkpoint)
	%ContinueButton.pressed.connect(_continue_exploring)
	sensitivity_slider.value_changed.connect(_on_sensitivity_changed)
	invert_y_check.toggled.connect(func(value: bool) -> void: GameState.set_setting("invert_y", value))
	volume_slider.value_changed.connect(func(value: float) -> void: GameState.set_setting("master_volume", value))
	sensitivity_slider.value = float(GameState.get_setting("mouse_sensitivity", 0.0025))
	invert_y_check.button_pressed = bool(GameState.get_setting("invert_y", false))
	volume_slider.value = float(GameState.get_setting("master_volume", 0.8))
	seal_label.text = "WIND SEALS  %d / 3" % (GameState.save_data.get("wind_seal_ids", []) as Array).size()
	checkpoint_label.text = _prettify_id(String(GameState.save_data.get("checkpoint_id", "village_gate")))
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and not opening_overlay.visible and not ending_overlay.visible:
		if pause_overlay.visible:
			_resume_game()
		else:
			_pause_game()
		get_viewport().set_input_as_handled()


func _begin_journey() -> void:
	opening_overlay.hide()
	GameState.begin_game()
	AudioDirector.unlock_audio()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	GameState.request_tutorial(&"movement", "WASD to move  •  SHIFT to sprint  •  Mouse to look")


func _pause_game() -> void:
	pause_overlay.show()
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _resume_game() -> void:
	pause_overlay.hide()
	get_tree().paused = false
	if GameState.game_started:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _restart_checkpoint() -> void:
	if _player:
		GameState.respawn_player(_player)
	_resume_game()


func _continue_exploring() -> void:
	ending_overlay.hide()
	GameState.game_started = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _on_player_state_changed(_previous: PlayerController.MovementState, next: PlayerController.MovementState) -> void:
	state_label.text = PlayerController.MovementState.keys()[next].capitalize()


func _on_checkpoint_changed(checkpoint_id: StringName) -> void:
	checkpoint_label.text = _prettify_id(String(checkpoint_id))
	objective_label.text = "OBJECTIVE  Reach the Shrine of Returning Wind"


func _on_wind_seal_collected(_seal_id: StringName, total: int) -> void:
	seal_label.text = "WIND SEALS  %d / 3" % total
	_show_toast("Wind seal found — %d of 3" % total, false)


func _on_tutorial_requested(_tutorial_id: StringName, text: String) -> void:
	tutorial_label.text = text
	tutorial_panel.show()
	tutorial_timer.start(4.5)


func _on_interaction_changed(prompt: String) -> void:
	interaction_label.text = prompt
	interaction_label.visible = not prompt.is_empty()


func _on_dialogue_requested(speaker: String, text: String) -> void:
	speaker_label.text = speaker.to_upper()
	dialogue_label.text = text
	dialogue_panel.show()
	dialogue_timer.start(6.5)


func _on_save_notice(message: String, is_error: bool) -> void:
	_show_toast(message, is_error)


func _show_toast(message: String, is_error: bool) -> void:
	toast_label.text = message
	toast_label.modulate = Color("ffc1a8") if is_error else Color("c9f3df")
	toast_panel.show()
	toast_timer.start(4.0 if is_error else 2.2)


func _on_game_completed() -> void:
	GameState.game_started = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var seal_count := (GameState.save_data.get("wind_seal_ids", []) as Array).size()
	ending_seals_label.text = "Wind seals discovered: %d / 3" % seal_count
	ending_overlay.show()
	objective_label.text = "JOURNEY COMPLETE  The shrine is awake"


func _on_sensitivity_changed(value: float) -> void:
	GameState.set_setting("mouse_sensitivity", value)


func _prettify_id(value: String) -> String:
	return value.replace("_", " ").capitalize()

