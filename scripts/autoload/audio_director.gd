extends Node

var _ambient_player: AudioStreamPlayer
var _ambient_playback: AudioStreamGeneratorPlayback
var _rng := RandomNumberGenerator.new()
var _wind_value := 0.0
var _unlocked := false
var _sfx_cache: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_rng.seed = 1187
	_ambient_player = AudioStreamPlayer.new()
	_ambient_player.name = "ProceduralWind"
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 22050.0
	generator.buffer_length = 0.4
	_ambient_player.stream = generator
	_ambient_player.volume_db = -25.0
	add_child(_ambient_player)
	GameState.settings_changed.connect(_apply_settings)
	_apply_settings(GameState.save_data.get("settings", {}))
	set_process(false)


func unlock_audio() -> void:
	if _unlocked:
		return
	_unlocked = true
	_ambient_player.play()
	_ambient_playback = _ambient_player.get_stream_playback() as AudioStreamGeneratorPlayback
	set_process(true)


func _process(_delta: float) -> void:
	if _ambient_playback == null:
		return
	var frames := _ambient_playback.get_frames_available()
	for i in frames:
		_wind_value = lerpf(_wind_value, _rng.randf_range(-0.22, 0.22), 0.018)
		var breath := sin(float(Time.get_ticks_msec()) * 0.00035) * 0.035
		_ambient_playback.push_frame(Vector2.ONE * (_wind_value + breath))


func play_sfx(kind: StringName) -> void:
	if not _unlocked:
		return
	var stream: AudioStreamWAV = _sfx_cache.get(kind)
	if stream == null:
		stream = _build_tone(kind)
		_sfx_cache[kind] = stream
	var player := AudioStreamPlayer.new()
	player.stream = stream
	player.volume_db = -12.0
	add_child(player)
	player.finished.connect(player.queue_free)
	player.play()


func _build_tone(kind: StringName) -> AudioStreamWAV:
	var sample_rate := 22050
	var duration := 0.16
	var frequency := 240.0
	match kind:
		&"jump":
			frequency = 330.0
			duration = 0.12
		&"dash":
			frequency = 160.0
			duration = 0.22
		&"land":
			frequency = 90.0
			duration = 0.11
		&"seal":
			frequency = 660.0
			duration = 0.42
		&"checkpoint":
			frequency = 440.0
			duration = 0.3
	var frame_count := int(sample_rate * duration)
	var bytes := PackedByteArray()
	bytes.resize(frame_count * 2)
	for i in frame_count:
		var t := float(i) / sample_rate
		var envelope := pow(1.0 - float(i) / frame_count, 2.0)
		var sample := sin(TAU * frequency * t) * envelope * 0.35
		if kind == &"dash":
			sample += _rng.randf_range(-0.16, 0.16) * envelope
		var encoded := int(clampf(sample, -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, encoded)
	var wave := AudioStreamWAV.new()
	wave.format = AudioStreamWAV.FORMAT_16_BITS
	wave.mix_rate = sample_rate
	wave.stereo = false
	wave.data = bytes
	return wave


func _apply_settings(settings: Dictionary) -> void:
	var linear := float(settings.get("master_volume", 0.8))
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(linear, 0.001)))
	AudioServer.set_bus_mute(0, linear <= 0.001)

