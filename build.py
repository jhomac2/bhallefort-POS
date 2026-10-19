import re, sys, os, glob
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(root, p), encoding='utf8').read()
css = rd('src/styles.css')
body = rd('template.html')
vendor = rd('vendor/jspdf.umd.min.js') + '\n' + rd('vendor/jspdf.plugin.autotable.min.js')
app = '\n'.join(rd(f) for f in sorted(os.path.relpath(p, root) for p in glob.glob(os.path.join(root, 'src', '[0-9]*.js'))))
for name, s in (('vendor', vendor), ('app', app)):
    assert '</script' not in s.lower(), name + ' contiene </script'
font = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&display=swap">'
title = 'Bhalleffort'
core = f'<title>{title}</title>\n{font}\n<style>\n{css}\n</style>\n{body}\n<script>\n{vendor}\n</script>\n<script>\n{app}\n</script>\n'
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
open(os.path.join(root, 'dist/artifact.html'), 'w', encoding='utf8').write(core)
full = f'<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark">\n{core}</head></html>'
# documento independiente: el contenido va dentro de <body>
pwa = '<meta name="theme-color" content="#10241d"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
sw_reg = "if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); }); }"
full = f'<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{title}</title>\n{pwa}\n{font}\n<style>\n{css}\n</style></head>\n<body>\n{body}\n<script>\n{vendor}\n</script>\n<script>\n{app}\n</script>\n<script>\n{sw_reg}\n</script>\n</body></html>\n'
open(os.path.join(root, 'dist/bhalleffort.html'), 'w', encoding='utf8').write(full)
print('artifact.html', os.path.getsize(os.path.join(root, 'dist/artifact.html')) // 1024, 'KB')
print('bhalleffort.html', os.path.getsize(os.path.join(root, 'dist/bhalleffort.html')) // 1024, 'KB')
# copia lista para GitHub Pages / uso directo
open(os.path.join(root, 'index.html'), 'w', encoding='utf8').write(full)
