extends Node3D

const PLAYER_SCENE := preload("res://scenes/player.tscn")
const HUD_SCENE := preload("res://scenes/hud.tscn")
const CHECKPOINT_SCRIPT := preload("res://scripts/world/checkpoint.gd")
const WIND_SEAL_SCRIPT := preload("res://scripts/world/wind_seal.gd")
const NPC_SCRIPT := preload("res://scripts/world/wanderer_npc.gd")
const TUTORIAL_SCRIPT := preload("res://scripts/world/tutorial_area.gd")
const SHRINE_SCRIPT := preload("res://scripts/world/shrine_goal.gd")

var _materials: Dictionary = {}
var _player: PlayerController
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 20261012
	_build_valley()
	_build_landmarks()
	_build_route_content()
	_player = PLAYER_SCENE.instantiate() as PlayerController
	add_child(_player)
	_player.global_position = Vector3(0.0, 2.0, 120.0)
	add_child(HUD_SCENE.instantiate())
	await get_tree().process_frame
	GameState.respawn_player(_player)


func _build_valley() -> void:
	_create_box("ValleyFloor", Vector3(0, -1.2, -20), Vector3(100, 2.4, 340), Color("7f9663"))
	_create_box("WestCliffs", Vector3(-57, 9, -20), Vector3(18, 22, 350), Color("465b4e"))
	_create_box("EastCliffs", Vector3(57, 9, -20), Vector3(18, 22, 350), Color("536354"))
	_create_box("SouthBoundary", Vector3(0, 7, 153), Vector3(120, 18, 8), Color("50604e"))
	_create_box("NorthBoundary", Vector3(0, 18, -193), Vector3(120, 38, 8), Color("3b4b45"))

	# A raised northern shelf and a second shrine shelf make the landscape read as a climb.
	_create_box("LowerCliffShelf", Vector3(0, 4.0, -63), Vector3(100, 8, 67), Color("66735b"))
	_create_ramp("LowerMountainPath", Vector3(-4, 4.1, -24), Vector3(16, 1.2, 30), 17.0, Color("8c8968"))
	_create_box("HighCliffShelf", Vector3(0, 14.2, -145), Vector3(100, 12.4, 94), Color("596755"))
	_create_ramp("UpperMountainPath", Vector3(6, 14.0, -105), Vector3(15, 1.2, 34), 20.0, Color("817c63"))

	# A readable road ribbon; slightly raised to avoid z-fighting.
	for z in range(125, -9, -14):
		_create_box("Road_%s" % z, Vector3(0, 0.035, z), Vector3(7, 0.07, 11), Color("b3a67c"), false)
	for z in range(-47, -89, -13):
		_create_box("HighRoad_%s" % z, Vector3(0, 8.05, z), Vector3(7, 0.08, 10), Color("aea078"), false)
	for z in range(-121, -181, -13):
		_create_box("ShrineRoad_%s" % z, Vector3(0, 20.44, z), Vector3(7, 0.08, 10), Color("aa9b75"), false)

	_build_bamboo_grove()
	_build_watercourse()


func _build_landmarks() -> void:
	# Village gate.
	_create_box("GateLeft", Vector3(-4.5, 2.5, 132), Vector3(1, 5, 1), Color("713b2c"))
	_create_box("GateRight", Vector3(4.5, 2.5, 132), Vector3(1, 5, 1), Color("713b2c"))
	_create_box("GateBeam", Vector3(0, 5.1, 132), Vector3(11, 0.8, 1.2), Color("8e4832"))
	_create_box("GateRoof", Vector3(0, 6.0, 132), Vector3(13, 0.5, 3), Color("263f3c"))

	for data in [
		[Vector3(-15, 0, 112), Vector3(10, 5, 9)],
		[Vector3(16, 0, 104), Vector3(12, 6, 10)],
		[Vector3(-18, 0, 87), Vector3(9, 5, 8)],
		[Vector3(18, 0, 78), Vector3(11, 5, 9)],
	]:
		_build_house(data[0], data[1])

	# Cliff arch announces the vertical traversal area.
	_create_box("CliffArchLeft", Vector3(-8, 12.5, -82), Vector3(2.2, 9, 2.2), Color("594b42"))
	_create_box("CliffArchRight", Vector3(8, 12.5, -82), Vector3(2.2, 9, 2.2), Color("594b42"))
	_create_box("CliffArchTop", Vector3(0, 17.0, -82), Vector3(19, 1.3, 3), Color("6d5040"))

	_build_shrine(Vector3(0, 20.45, -168))
	_add_landmark_label("MISTVEIL VILLAGE", Vector3(0, 7.4, 132))
	_add_landmark_label("BAMBOO WHISPER GROVE", Vector3(0, 5.8, 45))
	_add_landmark_label("CLOUDSTEP CLIFF", Vector3(0, 18.7, -82))
	_add_landmark_label("SHRINE OF RETURNING WIND", Vector3(0, 28.0, -168))


func _build_route_content() -> void:
	_create_checkpoint(&"village_gate", Vector3(0, 0.2, 120), "Village Gate")
	_create_checkpoint(&"cliff_camp", Vector3(0, 8.2, -66), "Cliff Camp")
	_create_checkpoint(&"shrine_approach", Vector3(0, 20.55, -146), "Shrine Approach")

	_create_wind_seal(&"rooftop_moon", "Seal of the Rooftop Moon", Vector3(-15, 7.0, 112))
	_create_wind_seal(&"bamboo_whisper", "Seal of Bamboo Whispers", Vector3(29, 2.0, 38))
	_create_wind_seal(&"cliff_breath", "Seal of the Cliff's Breath", Vector3(17, 14.0, -72))

	# Mantle route to the first optional seal.
	_create_box("VillageCrateA", Vector3(-8.5, 0.65, 112), Vector3(1.6, 1.3, 1.6), Color("82623f"))
	_create_box("VillageCrateB", Vector3(-10.2, 1.25, 112), Vector3(1.7, 2.5, 1.7), Color("705337"))
	_create_box("VillageAwning", Vector3(-12.5, 2.7, 112), Vector3(3.8, 0.45, 3.5), Color("9a5540"))

	# Two explicit wall-run surfaces form an optional shortcut beside the safe ramps.
	_create_box("WallRunLower", Vector3(15.5, 4.5, -28), Vector3(1.0, 9, 27), Color("53695f"), true, &"traversable_wall")
	_create_box("WallRunUpper", Vector3(-15.5, 14.6, -106), Vector3(1.0, 10, 28), Color("4d625a"), true, &"traversable_wall")
	_create_box("ShortcutLedgeA", Vector3(12.0, 8.4, -43), Vector3(7, 0.8, 5), Color("74806c"))
	_create_box("ShortcutLedgeB", Vector3(-12.0, 20.4, -121), Vector3(7, 0.8, 5), Color("6f7967"))

	_create_tutorial(&"movement", "WASD to move  •  SHIFT to sprint  •  Mouse to look", Vector3(0, 2, 113), Vector3(10, 4, 9))
	_create_tutorial(&"jump", "SPACE to jump or mantle low ledges", Vector3(0, 2, 82), Vector3(11, 4, 8))
	_create_tutorial(&"dash", "Press Q in the air to spend one qinggong dash", Vector3(0, 3, 9), Vector3(13, 6, 10))
	_create_tutorial(&"wall_run", "Move beside jade-marked walls to run along them", Vector3(8, 5, -22), Vector3(22, 10, 9))

	_create_wanderer(Vector3(5.0, 0.0, 115.0))
	_create_shrine_goal(Vector3(0, 22.0, -171))


func _build_house(origin: Vector3, size: Vector3) -> void:
	_create_box("House", origin + Vector3(0, size.y * 0.5, 0), size, Color("d0b982"))
	_create_box("Roof", origin + Vector3(0, size.y + 0.45, 0), Vector3(size.x + 2.2, 0.65, size.z + 2.2), Color("294543"))
	_create_box("RoofCap", origin + Vector3(0, size.y + 1.0, 0), Vector3(size.x * 0.65, 0.45, size.z + 2.8), Color("203937"))
	_create_box("Door", origin + Vector3(0, 1.25, size.z * 0.5 + 0.03), Vector3(1.6, 2.5, 0.15), Color("65392d"), false)


func _build_shrine(origin: Vector3) -> void:
	_create_box("ShrinePlatform", origin + Vector3(0, 0.35, 0), Vector3(24, 0.7, 20), Color("777566"))
	for x in [-7.5, 7.5]:
		for z in [-5.5, 5.5]:
			_create_box("ShrinePillar", origin + Vector3(x, 3.2, z), Vector3(0.9, 6.4, 0.9), Color("8c392f"))
	_create_box("ShrineRoof", origin + Vector3(0, 6.6, 0), Vector3(20, 0.65, 17), Color("213c3d"))
	_create_box("ShrineRoofCap", origin + Vector3(0, 7.25, 0), Vector3(15, 0.5, 19), Color("172f31"))
	_create_box("Altar", origin + Vector3(0, 1.25, -2), Vector3(3.5, 2.5, 2.2), Color("6e4c37"))
	_create_box("SpiritStone", origin + Vector3(0, 3.0, -2), Vector3(1.1, 2.2, 0.65), Color("70c5ae"), false)


func _build_bamboo_grove() -> void:
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.09
	trunk_mesh.bottom_radius = 0.13
	trunk_mesh.height = 5.2
	trunk_mesh.radial_segments = 6
	trunk_mesh.material = _material(Color("557a4a"))
	var trunks := MultiMesh.new()
	trunks.transform_format = MultiMesh.TRANSFORM_3D
	trunks.mesh = trunk_mesh
	trunks.instance_count = 74
	var trunk_instances := MultiMeshInstance3D.new()
	trunk_instances.name = "BambooTrunks"
	trunk_instances.multimesh = trunks
	add_child(trunk_instances)

	var leaf_mesh := SphereMesh.new()
	leaf_mesh.radius = 0.55
	leaf_mesh.height = 1.5
	leaf_mesh.radial_segments = 6
	leaf_mesh.rings = 4
	leaf_mesh.material = _material(Color("365e43"))
	var leaves := MultiMesh.new()
	leaves.transform_format = MultiMesh.TRANSFORM_3D
	leaves.mesh = leaf_mesh
	leaves.instance_count = 74
	var leaf_instances := MultiMeshInstance3D.new()
	leaf_instances.name = "BambooLeaves"
	leaf_instances.multimesh = leaves
	add_child(leaf_instances)

	for i in 74:
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * _rng.randf_range(10.0, 42.0)
		var z := _rng.randf_range(15.0, 72.0)
		var scale := _rng.randf_range(0.82, 1.28)
		var transform := Transform3D(Basis.IDENTITY.scaled(Vector3(scale, scale, scale)), Vector3(x, 2.6 * scale, z))
		trunks.set_instance_transform(i, transform)
		var leaf_transform := Transform3D(Basis.IDENTITY.scaled(Vector3(scale, scale, scale)), Vector3(x, 5.0 * scale, z))
		leaves.set_instance_transform(i, leaf_transform)


func _build_watercourse() -> void:
	for z in range(130, -181, -18):
		var x := -32.0 + sin(float(z) * 0.045) * 4.0
		_create_box("Stream", Vector3(x, 0.04 if z > -25 else (8.05 if z > -105 else 20.45), z), Vector3(7, 0.08, 20), Color(0.24, 0.63, 0.68, 0.72), false)


func _create_box(node_name: String, position: Vector3, size: Vector3, color: Color, collision := true, group: StringName = &"") -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = position
	if group != &"":
		body.add_to_group(group)
	add_child(body)
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = _material(color)
	mesh_instance.mesh = mesh
	body.add_child(mesh_instance)
	if collision:
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		shape_node.shape = shape
		body.add_child(shape_node)
	return body


func _create_ramp(node_name: String, position: Vector3, size: Vector3, angle_degrees: float, color: Color) -> void:
	var ramp := _create_box(node_name, position, size, color)
	ramp.rotation_degrees.x = angle_degrees


func _material(color: Color) -> StandardMaterial3D:
	var key := color.to_html(true)
	if _materials.has(key):
		return _materials[key]
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.84
	if color.a < 1.0:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_materials[key] = material
	return material


func _create_trigger_shape(area: Area3D, size: Vector3) -> void:
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	area.add_child(collision)


func _create_checkpoint(id: StringName, position: Vector3, label_text: String) -> void:
	var area := Area3D.new()
	area.name = "Checkpoint_%s" % id
	area.position = position
	area.set_script(CHECKPOINT_SCRIPT)
	area.set("checkpoint_id", id)
	_create_trigger_shape(area, Vector3(4, 3, 4))
	var marker := MeshInstance3D.new()
	marker.name = "Marker"
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.8
	mesh.bottom_radius = 1.0
	mesh.height = 0.24
	mesh.radial_segments = 8
	marker.mesh = mesh
	marker.position.y = 0.14
	var unique_material := StandardMaterial3D.new()
	unique_material.albedo_color = Color("d7a95b")
	marker.material_override = unique_material
	area.add_child(marker)
	var label := Label3D.new()
	label.text = label_text
	label.position = Vector3(0, 1.55, 0)
	label.font_size = 32
	label.outline_size = 8
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	area.add_child(label)
	add_child(area)


func _create_wind_seal(id: StringName, title: String, position: Vector3) -> void:
	var area := Area3D.new()
	area.name = "WindSeal_%s" % id
	area.position = position
	area.set_script(WIND_SEAL_SCRIPT)
	area.set("seal_id", id)
	area.set("display_name", title)
	var collision := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 1.1
	collision.shape = shape
	area.add_child(collision)
	var mesh_instance := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.26
	mesh.outer_radius = 0.7
	mesh.rings = 12
	mesh.ring_segments = 6
	mesh_instance.mesh = mesh
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color("b6f2dc")
	glow.emission_enabled = true
	glow.emission = Color("54d6bd")
	glow.emission_energy_multiplier = 2.2
	mesh_instance.material_override = glow
	area.add_child(mesh_instance)
	add_child(area)


func _create_tutorial(id: StringName, text: String, position: Vector3, size: Vector3) -> void:
	var area := Area3D.new()
	area.name = "Tutorial_%s" % id
	area.position = position
	area.set_script(TUTORIAL_SCRIPT)
	area.set("tutorial_id", id)
	area.set("tutorial_text", text)
	_create_trigger_shape(area, size)
	add_child(area)


func _create_wanderer(position: Vector3) -> void:
	var npc := Area3D.new()
	npc.name = "OldWanderer"
	npc.position = position
	npc.set_script(NPC_SCRIPT)
	_create_trigger_shape(npc, Vector3(4, 3, 4))
	var body := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.38
	mesh.height = 1.7
	mesh.material = _material(Color("87644f"))
	body.mesh = mesh
	body.position.y = 0.9
	npc.add_child(body)
	var label := Label3D.new()
	label.text = "OLD WANDERER"
	label.position.y = 2.4
	label.font_size = 28
	label.outline_size = 8
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	npc.add_child(label)
	add_child(npc)


func _create_shrine_goal(position: Vector3) -> void:
	var goal := Area3D.new()
	goal.name = "ShrineGoal"
	goal.position = position
	goal.set_script(SHRINE_SCRIPT)
	_create_trigger_shape(goal, Vector3(5, 4, 5))
	add_child(goal)


func _add_landmark_label(text: String, position: Vector3) -> void:
	var label := Label3D.new()
	label.text = text
	label.position = position
	label.font_size = 38
	label.outline_size = 12
	label.modulate = Color("f4e6bf")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	add_child(label)

