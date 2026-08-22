import sys
from PIL import Image
src,out,box=sys.argv[1],sys.argv[2],sys.argv[3]
x,y,w,h=[int(v) for v in box.split(',')]
im=Image.open(src).crop((x,y,x+w,y+h))
sc=float(sys.argv[4]) if len(sys.argv)>4 else 1.0
if sc!=1.0: im=im.resize((int(im.width*sc),int(im.height*sc)),Image.LANCZOS)
im.save(out); print(out,im.size)
