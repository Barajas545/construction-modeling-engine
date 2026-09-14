"""Standalone CME concept scene. No changes to saved CME project data."""
import bpy, math, os
from mathutils import Vector

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'output', 'blender-concept'))
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.45, grain=False):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    n=m.node_tree.nodes; p=n.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    if grain:
        tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=5; tex.inputs['Detail'].default_value=2
        coord=n.new('ShaderNodeTexCoord'); mapping=n.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'; mapping.inputs[1].default_value=(2,65,8)
        ramp=n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position=.2; ramp.color_ramp.elements[0].color=(*(v*.62 for v in color),1)
        ramp.color_ramp.elements[1].position=.8; ramp.color_ramp.elements[1].color=(*(min(1,v*1.18) for v in color),1)
        links=m.node_tree.links; links.new(coord.outputs['Generated'],mapping.inputs[0]); links.new(mapping.outputs[0],tex.inputs['Vector']); links.new(tex.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],p.inputs['Base Color'])
    return m

wood=material('01 | Honey cedar · framing',(.43,.245,.105),grain=True)
deck=material('02 | Toasted oak · composite',(.32,.205,.125),grain=True)
edge=material('03 | Picture frame · walnut',(.18,.095,.048),grain=True)
steel=material('04 | Graphite powder coat',(.026,.037,.044),.7,.3)
concrete=material('05 | Cast concrete',(.32,.35,.34),roughness=.88)
green=material('06 | CME beam green',(.045,.21,.13),.15)
teal=material('07 | CME turquoise',(.045,.68,.62),.35)
ground=material('08 | Slate stage',(.035,.047,.056),roughness=.7)
silver=material('09 | Galvanized hardware',(.34,.39,.43),.8,.3)

def box(name, loc, size, mat, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft machined edges','BEVEL'); b.width=bevel; b.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def rod(name,a,b,width,mat):
    a,b=Vector(a),Vector(b); o=box(name,(a+b)/2,(width,width,(b-a).length),mat,min(width*.15,.006))
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o

def post(x,y,beam_bottom):
    box('Footing | concrete',(x,y,.10),(.43,.43,.20),concrete,.035)
    box('Post base | galvanized',(x,y,.235),(.20,.20,.07),silver)
    box('Post | PT',(x,y,(beam_bottom+.27)/2),(.14,.14,beam_bottom-.27),wood)
    box('Post cap',(x,y,beam_bottom),(.19,.19,.045),silver)

def platform(name,x0,x1,y0,y1,z,finished=False):
    # z is finished walking surface; member geometry is derived below it.
    box(name+' | left rim',(x0+.025,(y0+y1)/2,z-.145),(.05,y1-y0,.23),wood)
    box(name+' | right rim',(x1-.025,(y0+y1)/2,z-.145),(.05,y1-y0,.23),wood)
    for y in (y0+.025,y1-.025): box(name+' | end rim',((x0+x1)/2,y,z-.145),(x1-x0,.05,.23),wood)
    count=math.ceil((x1-x0)/.40)
    axes=[x0+.08+i*(x1-x0-.16)/count for i in range(count+1)]
    for i,x in enumerate(axes):
        box(name+f' | Joist {i+1}',(x,(y0+y1)/2,z-.145),(.045,y1-y0-.10,.23),wood)
    for row,y in enumerate((y0+.75,y1-.65)):
        box(name+' | Bottom beam',((x0+x1)/2,y,z-.40),(x1-x0+.10,.14,.28),green)
        for x in (x0+.18,(x0+x1)/2,x1-.18): post(x,y,z-.54)
        for i,(a,b) in enumerate(zip(axes,axes[1:])):
            box(name+' | Staggered blocking',((a+b)/2,y+(.045 if i%2 else -.045),z-.145),(b-a-.045,.045,.23),wood)
    if finished:
        w=.137; y=y0+.145
        while y<y1-.145:
            box(name+' | Deck board',((x0+x1)/2,y+w/2,z-.016),(x1-x0-.29,min(w,y1-.145-y),.032),deck,.004); y+=.143
        for x in (x0+.068,x1-.068): box(name+' | Picture frame',(x,(y0+y1)/2,z-.016),(.137,y1-y0,.032),edge,.004)
        for y in (y0+.068,y1-.068): box(name+' | Picture frame',((x0+x1)/2,y,z-.016),(x1-x0-.274,.137,.032),edge,.004)
        box(name+' | Fascia',((x0+x1)/2,y0-.018,z-.145),(x1-x0,.028,.25),edge)

def railing(a,b,z):
    a,b=Vector(a),Vector(b); length=(b-a).length; count=math.ceil(length/1.55); direction=(b-a).normalized()
    for i in range(count+1):
        p=a+(b-a)*i/count
        box('Railing | post',(p.x,p.y,z+.5),(.065,.065,1.02),steel)
        box('Railing | base plate',(p.x,p.y,z+.012),(.12,.12,.025),silver)
    for h in (.12,1.0): rod('Railing | horizontal rail',(a.x,a.y,z+h),(b.x,b.y,z+h),.035,steel)
    # Slim square-mesh Wild Hog style infill.
    for i in range(1,math.ceil(length/.11)):
        p=a+direction*min(i*.11,length)
        rod('Railing | mesh wire',(p.x,p.y,z+.14),(p.x,p.y,z+.97),.006,steel)
    for i in range(1,8):
        h=.14+i*.105; rod('Railing | mesh wire',(a.x,a.y,z+h),(b.x,b.y,z+h),.006,steel)
    rod('Railing | timber handrail',(a.x,a.y,z+1.045),(b.x,b.y,z+1.045),.075,edge)

# Two coherent adjoining levels. Right-hand deck is intentionally uncovered.
platform('Upper finished deck',-3.2,.05,-1.7,2.5,1.52,True)
platform('Lower framing reveal',.10,3.3,-1.7,2.5,1.34,False)
# A finished walkway on the lower rear edge makes the change in level explicit.
for i in range(5):
    box('Lower landing | board',(1.70,2.40-i*.143,1.324),(3.13,.137,.032),deck,.004)
railing((-3.15,-1.65),(-3.15,2.45),1.52)
railing((-3.15,2.45),(.0,2.45),1.52)
railing((.15,2.45),(3.25,2.45),1.34)
railing((3.25,2.45),(3.25,-1.63),1.34)

# Front stair: 8 equal rises, 7 treads, four continuous notched stringers.
sx0,sx1=.52,2.08
rise=1.34/8; run=.28; n=7; ytop=-1.70
for i in range(n):
    z=1.34-(i+1)*rise; yc=ytop-(i+.5)*run
    for j in range(2): box('Stair | tread board',((sx0+sx1)/2,yc+(j-.5)*.14,z-.016),(sx1-sx0,.135,.032),deck,.004)
    box('Stair | riser fascia',((sx0+sx1)/2,ytop-i*run-.016,z+rise/2),(sx1-sx0,.026,rise-.015),edge,.004)
for k in range(5):
    x=sx0+.045+k*(sx1-sx0-.09)/4
    profile=[(ytop,1.34-.032)]
    for i in range(n):
        z=1.34-(i+1)*rise-.032
        profile.extend([(ytop-i*run,z),(ytop-(i+1)*run,z)])
    profile.extend([(ytop-n*run,.08),(ytop,.99)])
    verts=[(x+dx,y,z) for dx in (-.0225,.0225) for y,z in profile]; m=len(profile)
    faces=[tuple(range(m-1,-1,-1)),tuple(range(m,m*2))]+[(i,(i+1)%m,(i+1)%m+m,i+m) for i in range(m)]
    mesh=bpy.data.meshes.new('Notched stringer'); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new('Stair | notched PT stringer',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(wood)
box('Stair | lower closure',((sx0+sx1)/2,ytop-n*run+.02,.105),(sx1-sx0,.045,.19),wood)
box('Stair | landing pad',((sx0+sx1)/2,ytop-n*run-.23,.015),(2.0,.75,.07),concrete,.025)

# Restrained presentation stage, turquoise inlay, and a physical title plate.
box('Presentation plinth',(0,-.45,-.17),(8.7,8.4,.26),ground,.10)
box('CME accent inlay',(0,-4.56,-.03),(7.6,.012,.006),teal,.001)
def label(body,loc,size,mat):
    bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.name=body
    o.data.body=body; o.data.size=size; o.data.extrude=.0005; o.data.materials.append(mat)
label('C M E',(-3.8,-4.30,-.03),.24,teal)
label('PROJECT X   /   STRUCTURE + SURFACE',(-2.75,-4.28,-.03),.115,silver)
box('Studio floor',(0,0,-.35),(200,200,.1),ground,0)

world=bpy.context.scene.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.16,.20,1); world.node_tree.nodes['Background'].inputs[1].default_value=.35
def light(name,loc,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.color=color; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
light('Warm architectural key',(-3,-4,9),1900,(1,.80,.58),7)
light('Cool studio rim',(4,4,7),2300,(.55,.80,1),6)
light('Front fill',(1,-6,5),700,(.85,.93,1),5)
bpy.ops.object.camera_add(location=(10,-14,11)); cam=bpy.context.object
cam.rotation_euler=(Vector((0,-.40,.60))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=12.5
s=bpy.context.scene; s.camera=cam; s.render.engine='CYCLES'; s.cycles.samples=32; s.cycles.use_denoising=True
s.render.resolution_x=1600; s.render.resolution_y=1400; s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'; s.render.filepath=os.path.join(OUT,'CME-Project-X.png')
s.view_settings.view_transform='AgX'
s['CME_NOTE']='Conceptual demonstration only. Not an export of the current saved CME project.'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'CME-Project-X.blend'))
bpy.ops.render.render(write_still=True)
print('CME_RENDER_COMPLETE',s.render.filepath)
