import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(__file__).parent
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/models/downlight-labot-ip65/v1/downlight-labot-ip65-v1.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.render.resolution_x=700;s.render.resolution_y=700;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('reference-world');s.world.color=(.06,.06,.06);s.view_settings.view_transform='AgX';s.view_settings.exposure=0
bpy.ops.object.camera_add(location=(.105,-.14,-.115));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.021))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.12;s.camera=cam
for pos,power,size in [((.03,-.13,-.11),.6,.15),((-.1,-.02,.08),.3,.12)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.02))-o.location).to_track_quat('-Z','Y').to_euler()
gray=bpy.data.materials.new('gray');gray.diffuse_color=(.5,.5,.5,1)
for name,scale,mat in [('01-silhouette-gray',.12,gray),('02-structure-gray-detail',.075,gray),('03-material',.12,None),('04-material-detail',.075,None)]:
 cam.data.ortho_scale=scale;s.view_layers[0].material_override=mat;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
cam.location=(.105,-.14,.14);cam.rotation_euler=(Vector((0,0,.023))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.12
s.render.filepath=str(out/'05-rear.png');bpy.ops.render.render(write_still=True)
